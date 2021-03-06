// reports_proposed/data/bilan.js
// Collects and aggregates data for the enterprise bilan

var q       = require('q');
var db      = require('../../../lib/db');
var numeral = require('numeral');
var formatDollar = '$0,0.00';

// expose the http route
exports.compile = function (options) {
  'use strict';
  var i18nBilan = options.language == 'fr' ? require('../lang/fr.json').BILAN : require('../lang/en.json').BILAN;
  var deferred = q.defer(), context = {}, infos = {}, assetData = {}, passiveData = {};
  var bilanDate = new Date();
  var sql =
    'SELECT `acc`.`id` AS `accountId`, `acc`.`account_txt` AS `accounTxt`, `acc`.`account_number` AS `accountNumber`, ' +
    '`acc`.`is_brut_link` AS `accountIsBrutLink`, `ref`.`id` AS `referenceId`, `ref`.`ref` AS `referenceAbbr`, `ref`.`text` AS `referenceLabel`, ' +
    '`ref`.`position` AS `referencePosition`, `gref`.`id` AS `greferenceId`, `ref`.`is_report` AS `referenceIsReport`, ' +
    '`gref`.`reference_group` AS `greferenceAbbr`, `gref`.`text` AS `greferenceLabel`, `gref`.`position` AS `greferencePosition`, ' +
    '`sbl`.`id` AS `sectionBilanId`, `sbl`.`text` AS `sectionBilanLabel`, `sbl`.`is_actif` AS `sectionBilanIsActif`, ' +
    '`sbl`.`position` AS `sectionBilanPosition`, SUM(`gld`.`debit_equiv`) AS `generalLegderDebit`, SUM(`gld`.`credit_equiv`) AS `generalLegderCredit`, `fy`.`fiscal_year_txt` AS fiscal ' +
    'FROM `section_bilan` `sbl` JOIN `reference_group` `gref` ON `sbl`.`id` = `gref`.`section_bilan_id` JOIN `reference` `ref` ON `gref`.`id` = `ref`.`reference_group_id` ' +
    'JOIN `account` `acc` ON `acc`.`reference_id` = `ref`.`id` JOIN `general_ledger` `gld` ON `gld`.`account_id` = `acc`.`id` JOIN `fiscal_year` `fy` ON `gld`.`fiscal_year_id` = `fy`.`id` WHERE `gld`.`period_id` IN (SELECT `id` ' +
    'FROM `period` WHERE `period`.`fiscal_year_id`=?) AND `acc`.`is_ohada`=? GROUP BY `gld`.`account_id` ORDER BY `sbl`.`position`, `gref`.`position`, `ref`.`position` ASC;';

  //populating context object
  context.reportDate = bilanDate.toDateString();
  context.options = options;
  context.i18nBilan = i18nBilan;

  db.exec(sql, [options.fy, 1])
  .then(function (ans) {
    infos.current_detail_list = ans;
    return q.all(options.parentIds.map(function (fid){
      return db.exec(sql, [fid, 1]);
    }));
  })
  .then(function (ans){

    ans = ans.map(function (items){
      var assets = items.filter(function (item){
        return item.sectionBilanIsActif === 1;
      });

      var passifs = items.filter(function (item){
        return item.sectionBilanIsActif === 0;
      });

      /** transform our array of array to an object which contains to array assets and passifs**/
      return {assets : assets, passifs : passifs};
    });

    infos.previous = ans;
    return q.when(infos);
  })
  .then(function (infos){
    //spliting into four set, asset for current and previous fiscal, passive for current and previous fiscal

    context.previous = infos.previous;
    assetData.current_detail_list = infos.current_detail_list.filter(function (item){
      return item.sectionBilanIsActif === 1;
    });

    passiveData.current_detail_list = infos.current_detail_list.filter(function (item){
      return item.sectionBilanIsActif === 0;
    });

    context.assetSide = processAsset(assetData);
    context.passiveSide = processPassive(passiveData);

    function processAsset (tbl){

      var currents = tbl.current_detail_list;
      var sections = (currents.length > 0) ? getSections(currents, 1) : [];

      context.assetGeneralBrut = 0; context.assetGeneralAmortProv = 0; context.assetGeneralNet = 0;

      /**initialize each context Genereal total for previous**/
      infos.previous.forEach(function (item, i){ context['assetGeneralPreviousNet' + i] = 0; });

      sections.forEach(function (section){
        section.totalBrut = 0; section.totalAmortProv = 0; section.totalNet = 0;

        /**initialize each section total previous**/
        infos.previous.forEach(function (item, i){ section['totalPreviousNet' + i] = 0; });
         
        section.grefs = getGroupReferences(section, currents);        
        section.grefs.forEach(function (gref){
          gref.totalBrut = 0; gref.totalAmortProv = 0; gref.totalNet = 0;

          /**initialize each group reference total previous**/
          infos.previous.forEach(function (item, i){ gref['totalPreviousNet' + i] = 0; });

          gref.refs = getReferences(gref, currents);
          gref.refs.forEach(function (item){

            //brut processing
            item.brut = getBrut(item, currents, section.sectionBilanIsActif);
            item.brut_view = numeral(item.brut).format(formatDollar);
            gref.totalBrut += item.brut;

            //amort/prov processing
            var amor = getAmortProv(item, currents, section.sectionBilanIsActif);
            item.amort_prov =  amor < 0 ? amor * -1 : amor;
            item.amort_prov_view = numeral(item.amort_prov).format(formatDollar);
            gref.totalAmortProv += item.amort_prov;

            //net processing
            item.net = item.brut - item.amort_prov;
            item.net_view = numeral(item.net).format(formatDollar);
            gref.totalNet += item.net;

            //previous net processing
            infos.previous.forEach(function (previousYearData, index){
              //processing brut for previous year
              item['brut' + index] = getBrut(item, previousYearData.assets, section.sectionBilanIsActif);
              item['brut_view' + index] = numeral(item['brut' + index]).format(formatDollar);

              //processing depreciation or provision for previous year
              var provAmor = getAmortProv(item, previousYearData.assets, section.sectionBilanIsActif);
              item['amort_prov' + index] = provAmor < 0 ? provAmor * -1 : provAmor;
              item['amort_prov_view' + index] = numeral(item['amort_prov' + index]).format(formatDollar);

              //processing previous net for previous year
              item['previousNet' + index] = getPreviousNet(item, previousYearData.assets, section.sectionBilanIsActif);
              item['previousNet_view' + index] = numeral(item['previousNet' + index]).format(formatDollar);

              //processing total previous net
              gref['totalPreviousNet' + index] += item['previousNet' + index];
            });            
          });

          /** calculate total for section **/
          section.totalBrut += gref.totalBrut;
          section.totalAmortProv += gref.totalAmortProv;
          section.totalNet += gref.totalNet;

          //transform through numeral interface for group reference
          gref.totalBrut_view = numeral(gref.totalBrut).format(formatDollar);
          gref.totalAmortProv_view = numeral(gref.totalAmortProv).format(formatDollar);
          gref.totalNet_view = numeral(gref.totalNet).format(formatDollar);

          /** iterate to have each total previous**/
          infos.previous.forEach(function (previousYearData, index){
            section['totalPreviousNet' + index] += gref['totalPreviousNet' + index];
            gref['totalPreviousNet_view' + index] = numeral(gref['totalPreviousNet' + index]).format(formatDollar);
          });          
        });

        context.assetGeneralBrut += section.totalBrut;
        context.assetGeneralNet += section.totalNet;
        context.assetGeneralAmortProv += section.totalAmortProv;

        /** iterate to have each total previous**/
        infos.previous.forEach(function (previousYearData, index){
          context['assetGeneralPreviousNet' + index] += section['totalPreviousNet' + index];
        }); 

        //processing total brut, amort, previous net
        section.totalBrut_view = numeral(section.totalBrut).format(formatDollar);
        section.totalAmortProv_view = numeral(section.totalAmortProv).format(formatDollar);
        section.totalNet_view = numeral(section.totalNet).format(formatDollar);

        /** iterate to have each total view previous**/
        infos.previous.forEach(function (previousYearData, index){
          section['totalPreviousNet_view' + index] = numeral(section['totalPreviousNet' + index]).format(formatDollar);
        });
      });

      context.assetGeneralBrut = numeral(context.assetGeneralBrut).format(formatDollar);
      context.assetGeneralAmortProv = numeral(context.assetGeneralAmortProv).format(formatDollar);
      context.assetGeneralNet = numeral(context.assetGeneralNet).format(formatDollar);

      /** iterate to have each total view previous**/
      infos.previous.forEach(function (previousYearData, index){
        context['assetGeneralPreviousNet' + index] = numeral(context['assetGeneralPreviousNet' + index]).format(formatDollar);
      });

      return sections;
    }

    function processPassive (tbl){
      var currents = tbl.current_detail_list;
      var sections = (currents.length > 0) ? getSections(currents, 0) : [];

      context.passiveGeneralBrut = 0; context.passiveGeneralAmortProv = 0; context.passiveGeneralNet = 0;

      /**initialize each context Genereal total for previous**/
      infos.previous.forEach(function (item, i){ context['passiveGeneralPreviousNet' + i] = 0; });

      sections.forEach(function (section){
        section.totalNet = 0;

        /**initialize each section total previous**/
        infos.previous.forEach(function (item, i){ section['totalPreviousNet' + i] = 0; });

        section.grefs = getGroupReferences(section, currents);
        section.grefs.forEach(function (gref){
          gref.totalNet = 0;

          /**initialize each section total previous**/
          infos.previous.forEach(function (item, i){ gref['totalPreviousNet' + i] = 0; });

          gref.refs = getReferences(gref, currents);
          gref.refs.forEach(function (item){
            item.net = getBrut(item, currents, section.sectionBilanIsActif); // brut is the net
            item.net_view = numeral(item.net).format(formatDollar);
            gref.totalNet += item.net;

            //previous net processing
            infos.previous.forEach(function (previousYearData, index){
              item['previousNet' + index] = getPreviousNet(item, previousYearData.passifs, section.sectionBilanIsActif);
              // item['previousNet' + index] = item['previousNet' + index] < 0 ? item['previousNet' + index] * -1 : item['previousNet' + index];

              item['previousNet_view' + index] = numeral(item['previousNet' + index]).format(formatDollar);
              gref['totalPreviousNet' + index] += item['previousNet' + index];
            }); 
          });

          section.totalNet += gref.totalNet;

          gref.totalNet_view = numeral(gref.totalNet).format(formatDollar);

          /** iterate to have each total previous**/
          infos.previous.forEach(function (previousYearData, index){
            section['totalPreviousNet' + index] += gref['totalPreviousNet' + index];
            gref['totalPreviousNet_view' + index] = numeral(gref['totalPreviousNet' + index]).format(formatDollar);
          });  
        });

        context.passiveGeneralNet += section.totalNet;

        /** iterate to have each total previous**/
        infos.previous.forEach(function (previousYearData, index){
          context['passiveGeneralPreviousNet' + index] += section['totalPreviousNet' + index];
        }); 

        section.totalNet_view = numeral(section.totalNet).format(formatDollar);

        /** iterate to have each total view previous**/
        infos.previous.forEach(function (previousYearData, index){
          section['totalPreviousNet_view' + index] = numeral(section['totalPreviousNet' + index]).format(formatDollar);
        });        
      });

      context.passiveGeneralNet = numeral(context.passiveGeneralNet).format(formatDollar);

      /** iterate to have each total view previous**/
      infos.previous.forEach(function (previousYearData, index){
        context['passiveGeneralPreviousNet' + index] = numeral(context['passiveGeneralPreviousNet' + index]).format(formatDollar);
      });

      return sections;
    }

    function exist (obj, arr, crit){
      return arr.some(function (item){
        return obj[crit] == item[crit];
      });
    }

    function getSections (list, isActif){
      var sections = [];
      /** fecthing sections from current fiscal years array**/
      for(var i = 0; i <= list.length - 1; i++){
        if(list[i].sectionBilanIsActif === isActif){
          if(!exist(list[i], sections, 'sectionBilanId')){
            sections.push({
              sectionBilanId : list[i].sectionBilanId,
              sectionBilanPosition : list[i].sectionBilanPosition,
              sectionBilanLabel : list[i].sectionBilanLabel,
              sectionBilanIsActif : list[i].sectionBilanIsActif,
              grefs : []
            });
          }
        }        
      }

      /** getting section form previous**/
      infos.previous.forEach(function (item){
        var previous = [];
        previous = previous.concat(item.assets);
        previous = previous.concat(item.passifs);
        previous.forEach(function (item){
          if(item.sectionBilanIsActif === isActif){
            if(!exist(item, sections, 'sectionBilanId')){
              sections.push({
                sectionBilanId : item.sectionBilanId,
                sectionBilanPosition : item.sectionBilanPosition,
                sectionBilanLabel : item.sectionBilanLabel,
                sectionBilanIsActif : item.sectionBilanIsActif,
                grefs : []
              });
            }
          }
        });        
      });

      return sections;
    }

    function getGroupReferences (section, list){
      var greferences = [];

      list.forEach(function (item){
        if(item.sectionBilanId === section.sectionBilanId){
          if(!exist(item, greferences, 'greferenceId')){
            greferences.push({
              greferenceId : item.greferenceId,
              greferenceAbbr : item.greferenceAbbr,
              greferencePosition : item.greferencePosition,
              greferenceLabel : item.greferenceLabel,
              refs : []
            });
          }
        }
      });

      /** getting group reference form previous**/
      infos.previous.forEach(function (items){
        var previous = [];
        previous = previous.concat(items.assets);
        previous = previous.concat(items.passifs);

        previous.forEach(function (item){
          if(item.sectionBilanId === section.sectionBilanId){
            if(!exist(item, greferences, 'greferenceId')){
              greferences.push({
                greferenceId : item.greferenceId,
                greferenceAbbr : item.greferenceAbbr,
                greferencePosition : item.greferencePosition,
                greferenceLabel : item.greferenceLabel,
                refs : []
              });
            }
          }          
        });
      });

      return greferences;
    }

    function getReferences (greference, list){
      var references = [];

      list.forEach(function (item){
        if(item.greferenceId == greference.greferenceId){
          if(!exist(item, references, 'referenceId')){
            references.push({
              referenceId : item.referenceId,
              referenceAbbr : item.referenceAbbr,
              referencePosition : item.referencePosition,
              referenceLabel : item.referenceLabel,
              brut : 0,
              amort_prov : 0,
              net : 0,
              previousNet : 0
            });
          }
        }
      });

      /** getting reference form previous**/
      infos.previous.forEach(function (items){
        var previous = [];
        previous = previous.concat(items.assets);
        previous = previous.concat(items.passifs);

        previous.forEach(function (item){
          if(item.greferenceId == greference.greferenceId){
            if(!exist(item, references, 'referenceId')){
              references.push({
                referenceId : item.referenceId,
                referenceAbbr : item.referenceAbbr,
                referencePosition : item.referencePosition,
                referenceLabel : item.referenceLabel,
                brut : 0,
                amort_prov : 0,
                net : 0,
                previousNet : 0
              });
            }
          }          
        });
      });

      return references;
    }

    function getBrut (reference, list, isActif){
      var somDebit = 0, somCredit = 0;

      list.forEach(function (item){
        if(item.referenceId === reference.referenceId && item.accountIsBrutLink === 1){
          somDebit+=item.generalLegderDebit;
          somCredit+=item.generalLegderCredit;
        }
      });

      return (isActif === 1)? somDebit - somCredit : somCredit - somDebit;
    }

    function getAmortProv (reference, list, isActif){
      var somDebit = 0, somCredit = 0;

      list.forEach(function (item){
        if(item.referenceId === reference.referenceId && item.accountIsBrutLink === 0){
          somDebit+=(item.generalLegderDebit);
          somCredit+=(item.generalLegderCredit);
        }
      });
      return isActif === 1 ? somDebit - somCredit : somCredit - somDebit;
    }

    function getPreviousNet (reference, previous, isActif){
      var somDebitBrut = 0, somCreditBrut = 0, somDebitAmorProv = 0, somCreditAmorProv = 0;

      previous.forEach(function (item, index){
        if(item.referenceId == reference.referenceId && item.accountIsBrutLink == 0){
          somDebitAmorProv += (item.generalLegderDebit) * -1;
          somCreditAmorProv += (item.generalLegderCredit) * -1;
        }else if(item.referenceId == reference.referenceId && item.accountIsBrutLink == 1){
          somDebitBrut += item.generalLegderDebit;
          somCreditBrut += item.generalLegderCredit;
        }
      });
      return isActif == 1 ? (somDebitBrut - somCreditBrut) - (somDebitAmorProv - somCreditAmorProv) : (somCreditBrut - somDebitBrut) - (somCreditAmorProv - somDebitAmorProv);
    }

    deferred.resolve(context);
  })
  .catch(deferred.reject)
  .done();

  return deferred.promise;
};
