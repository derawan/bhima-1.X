/*kapok v0.0.1 - Wednesday, November 27th, 2013, 9:03:42 AM */
angular.module('kpk.controllers', []);

'use strict'
angular.module('kpk.controllers').controller('createAccountController', function($scope, $q, connect) { 
  console.log("createAccountController initialised");

  $scope.model = {};
  $scope.model['accounts'] = {'data' : []};

//  Request
  var account_request = {
    'tables' : {
      'account' : {
        'columns' : ["id", "account_txt", "account_type_id", "fixed"]
      }
    }
  }

  //  grid options
  var grid;
  var dataview;
  var sort_column = "id";
  var columns = [
    {id: 'id', name: 'No.', field: 'id', sortable: true, maxWidth: 80},
    {id: 'account_txt', name: 'Text', field: 'account_txt'},
    {id: 'account_type_id', name: 'Type', field: 'account_type_id', maxWidth: 60},
    {id: 'fixed', name: 'Fixed', field: 'fixed', maxWidth: 60}
  ];
  var options = {
    enableCellNavigation: true,
    enableColumnReorder: true,
    forceFitColumns: true,
    /*Bootstrap style row height*/
    rowHeight: 30
  };

  function init() { 

    connect.req(account_request).then(function(res) { 
      $scope.model['accounts'] = res;
      console.log($scope.model['accounts'].data);
      grid = new Slick.Grid('#account_grid', $scope.model['accounts'].data, columns, options);
    })
  }

  init();
});
angular.module('kpk.controllers').controller('accountController', function($scope, $q, $modal, connect, appstate) {

    function getData () {

      var account_defn, account_type_defn, 
          account_store, type_store,
          enterpriseid = appstate.get("enterprise").id;

      account_defn = {
        tables: {
          'account': {
            columns: ['enterprise_id', 'id', 'account_number', 'locked', 'account_txt', 'account_category', 'account_type_id', 'fixed'],
          },
          'account_type': {
            columns: ['type'] 
          }
        },
        join: ['account.account_type_id=account_type.id'],
        where: ["account.enterprise_id=" + enterpriseid],
      };

      account_type_defn = {
        tables: {
          'account_type' : {
            columns: ['id', 'type']
          }
        },
      };
      
      return $q.all([connect.req(account_defn), connect.req(account_type_defn)]);
    }

    function initGrid () {
      var grid, columns, options, dataview;
     
      // dataview config 
      dataview = new Slick.Data.DataView();

      dataview.onRowCountChanged.subscribe(function (e, args) {
        grid.updateRowCount();
        grid.render(); 
      });

      dataview.onRowsChanged.subscribe(function (e, args) {
        grid.invalidate(args.rows);
        grid.render();
      });

      columns = [
        {id: "account_number"       , name: "Account Number"   , field: "account_number", sortable: true},
        {id: "txt"      , name: "Account Text"     , field: "account_txt", sortable: true},
        {id: "type"     , name: "Account Type"     , field: "type"},
        {id: "category" , name: "Account Category" , field: "account_category"},
        {id: "fixed"    , name: "Fixed/Variable"   , field: "fixed"},
        {id: "locked"   , name: "Locked"           , field: "locked", sortable: true}
      ];

      options = {
        editable             : true,
        autoEdit             : false,
        asyncEditorLoading   : false,
        enableCellNavigation : true,
        forceFitColumns      : true
      };

      grid = new Slick.Grid("#kpk-accounts-grid", dataview, columns, options);

      function sorter (e, args) {
        var field = args.sortCol.field;
        function sort (a, b) { return (a[field] > b[field]) ? 1 : -1; }
        dataview.sort(sort, args.sortAsc);
        grid.invalidate();
      }

      grid.onSort.subscribe(sorter);

      return {grid: grid, dataview: dataview};

    }

    var promise = getData();
 
    $scope.models = {};
    $scope.stores = {};
    var dataview, grid;

    promise.then(function (a) {
      $scope.models.accounts = a[0].data;
      $scope.stores.accounts = a[0];
      $scope.models.types = a[1].data;
      var setup = initGrid(); 
      grid = setup.grid;
      $scope.dataview = setup.dataview;
      
      $scope.$watch('models.accounts', function () {
        console.log("model changed!");
        $scope.dataview.setItems($scope.models.accounts);
      });
    });

    $scope.create = function () {
      var instance = $modal.open({
        templateUrl: "/partials/accounts/templates/chart-modal.html",
        backdrop: true,
        controller: function ($scope, $modalInstance, types) {
          // work around because of issue #969
          $scope.$modalInstance = $modalInstance;
          $scope.types = types;
        },
        resolve: {
          types: function() {
            return $scope.models.types;
          },
        }
      });

      instance.result.then(function(account) {
        account.id = $scope.stores.accounts.generateid();
        account.enterprise_id = appstate.get('enterprise').id;
        $scope.stores.accounts.post(account);
        // TODO: This works, but have to refresh grid to make it work.
        $scope.dataview.setItems($scope.models.accounts);
      }, function() {});
    };

  });

angular.module('kpk.controllers').controller('accountFormController', function ($scope) {
      $scope.account = {};
      $scope.account.locked = 0;
      $scope.close = function () {
        $scope.$modalInstance.dismiss(); 
      };
      $scope.submit = function () {
        if ($scope.accountForm.$invalid) $scope.invalid = true;
        else $scope.$modalInstance.close($scope.account);
      };
  });
angular.module('kpk.controllers').controller('budgetController', function($scope, $q, connect, appstate) { 
    /////
    //  summary: 
    //    Controller behaviour for the budgeting unit, fetches displays and allows updates on data joined from 
    //    enterprise, account, fiscal year, period and budget
    //  TODO
    //    -Split budgeting unit into 3 or 4  controllers, one for each component
    //    -Memory in budgeting, fiscal years compared should be re-initialised, most used accounts, etc.
    /////
    

    //TODO: This data can be fetched from the application level service
    $scope.enterprise = {
      name : "IMA",
      city : "Kinshasa",
      country : "RDC",
      id : 102
    };

    var current_fiscal = {
      id : 2013011
    };

    init();

    function init() { 
      appstate.register("enterprise", function(res) { 
        createBudget(res.id);

        //Expose to scope for view
        $scope.enterprise = res;
      });
    }

    function createBudget(e_id) { 
      var account_model = {};
      var fiscal_model = {};
      var budget_model = {reports: []};

      var default_account_select;

      var promise = fetchAccount(e_id);
      promise
      .then(function(model) { 
        account_model = model;
        default_account_select = account_model.data[0].id; //First account in list, could be loaded from cache (model.get(cache_id))
        return fetchFiscal(e_id);
      })
      .then(function(model) { 
        fiscal_model = model;

        //set the first budget report - this will be populated in updateReport
        var default_fiscal = appstate.get("fiscal") //Risky with validation checks
        budget_model.reports.push({id : default_fiscal.id, desc : default_fiscal.fiscal_year_txt, model :  {}})
        fiscal_model.remove(default_fiscal.id);
        return updateReport(default_account_select, budget_model.reports);
      })
      .then(function(model) { 
        //All models populated - expose to $scope
        $scope.account_model = account_model;
        $scope.fiscal_model = fiscal_model;
        //TODO: Util function to check if there are any fiscal years left
        //Default select
        $scope.selected_fiscal = $scope.fiscal_model.data[0];
        $scope.selected_account = $scope.account_model.get(default_account_select); 
        $scope.budget_model = budget_model;

        console.log(budget_model);
        //Model has already been populated by default
        setSelected(default_account_select); //optional/ can expose default to $scope, or wait for user selection
      });
    }

    function fetchAccount(e_id) { 
      var deferred = $q.defer();
      var account_query = {
        'tables' : {
          'account' : {
            'columns' : ["id", "account_txt", "account_category"]
            }
        },
        'where' : ['account.enterprise_id=' + e_id]
      }
      connect.req(account_query).then(function(model) {
        deferred.resolve(model);
      });
      return deferred.promise;
    }

    function fetchFiscal(e_id) { 
      /////
      // summary:  
      //  Create model with all fiscal years for budget comparison 
      // ~
      //  Fiscal year data for a given enterprise already exists in the outside application, this could either be used directly (very 
      //  specific example) or the data downloaded could be cached using the connect service (ref: connect, sockets)
      /////
      var fiscal_query = {
        'tables' : {
          'fiscal_year' : {
            'columns' : ["id", "fiscal_year_txt"]
          }
        },
        'where' : ['fiscal_year.enterprise_id=' + e_id]
      }
      var deferred = $q.defer();
      connect.req(fiscal_query).then(function(model) {
        deferred.resolve(model);
      });
      return deferred.promise;
    }

    //FIXME: seperate complete update from fetching individudal model (call populateModel() loopping through reports.length)
    // Models should not be updated or refreshed on a new comparison
    function updateReport(account_id, reports) { 
      var deferred = $q.defer();

      for(var i = 0, l = reports.length; i < l; i++) { 
        var y = reports[i];

        (function(i, y) { 
          fetchBudget(account_id, y.id).then(function(model) { 
            y.model = indexMonths(model);
            y.display = formatBudget(y.model);
            console.log("fetchBudget", i, l);
            if(i==l-1) { 
              console.log("resolving", reports);
              deferred.resolve(reports);
            }
          });
        })(i, y);
      }
      return deferred.promise;
    }

    function populateModel() { 

    }
   
    function fetchBudget(account_id, fiscal_year) { 
      //FIXME: request object should be formed using connect API, or straight table downloaded etc - implementation decision
      var deferred = $q.defer();
      var budget_query = {
        'e' : [{
          t : 'period',
          c : ['period_start', 'period_stop'] 
        }, {
          t : 'budget',
          c : ['id', 'account_id', 'period_id', 'budget']
        }],
        'jc': [{
          ts: ['period', 'budget'],
          c: ['id', 'period_id'],
          l: 'AND'
        }],
        'c': [{
          t: 'budget',
          cl: 'account_id',
          z: '=', 
          v: account_id, 
          l: 'AND' 
        }, 
        {
          t: 'period',
          cl: 'fiscal_year_id', 
          z: '=',
          v: fiscal_year
      }]};

      connect.basicReq(budget_query).then(function(model) { 
        deferred.resolve(model);
      });
      return deferred.promise;
    }

    function indexMonths(model) {
      //not ideal as it changes the model? can be updated 
      var month_index = {};
      var d = model.data;
      for(var i = d.length - 1; i >= 0; i--) {
          var month = (new Date(d[i].period_start).getMonth());
          month_index[month] = d[i]["id"];
      }
      model.month_index = month_index;
      return model;
    }

    function setSelected(account_id) { 
      //Selection has been successful - update $scope
      //Set account as selected
      $scope.selected_account = $scope.account_model.get(account_id);
      //Set flag for DOM, displaying the report
      $scope.active = "report";
    }

    function formatBudget(model) { 
      var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dev"];

      var format = [];
      for (var i = 0, c = months.length; i < c; i++) {
        var l = model.month_index[i];
        if(l) { 
          var data = model.get(l);
          //FIXME: repeated data in model and period
          data.actual = 0; //actual placeholder
          format.push(data);
          console.log("format", data);
        } else { 
          format.push(null);
        }
      };
      console.log("f return", format);
      return format;
    }

    $scope.select = function(account_id) { 
      //see $scope.$evalAsync() - ng-init not updating      
      var promise = updateReport(account_id, $scope.budget_model.reports);
      promise
      .then(function(model) { 
        //Report models updated - expose to $scope
        $scope.budget_model.reports = model;
        setSelected(account_id);
      });      
    }

    $scope.filterMonth = function(report, index) {
      console.log("filterMonth request", report);
      console.log("month_index", report.model.month_index);
      console.log("index", index);
      if(report.model.month_index) {
      var l = report.model.month_index[index];
      if(l) { 
        return report.model.get(l);
      }
      }
    };

    /*This isn't optimal*/
    $scope.sum = function(report) { 
      //TODO: check if line.budget exists or something
      if(report.model.data) { 
        var total = 0;
        report.model.data.forEach(function(line) { 
          total += Number(line.budget);
        });
        return total;
      }
      return null;
    };

    $scope.compare = function() { 
      console.log("compare");
      $scope.budget_model.reports.push({id : $scope.selected_fiscal.id, desc : $scope.selected_fiscal.fiscal_year_txt, model : {}});
      $scope.select($scope.selected_account.id);
      console.log("cmp", $scope.selected_fiscal);
      $scope.fiscal_model.remove($scope.selected_fiscal.id);
      $scope.selected_fiscal = $scope.fiscal_model.data[0];
    };

    $scope.deleteCompare = function(report) { 
      var arr = $scope.budget_model.reports;
      arr.splice(arr.indexOf(report), 1);
      //update fiscal select
      //hard coded bad-ness
      $scope.fiscal_model.post({id : report.id, fiscal_year_txt : report.desc});
      $scope.selected_fiscal = $scope.fiscal_model.get(report.id);
    };

    $scope.validSelect = function() { 
      //ugly
      if($scope.fiscal_model) { 
        if($scope.fiscal_model.data.length > 0) { 
          return false;
        } 
      }
      
      return true;
    };

    init();
  });
angular.module('kpk.controllers').controller('cashController', function($scope, connect, $q, $filter, $http, appstate) {
    var enterprise, debitors, cash_items, cash,
        currency, enterprise_id, cash_account;
    cash_account = appstate.get('enterprise').cash_account;
    enterprise_id = appstate.get('enterprise').id;

    debitors = {
      tables: {
        'patient' : {columns: ["first_name", "last_name"]},
        'debitor' : {columns: ["id"]},
        'debitor_group' : {columns: ['name', 'account_number', 'max_credit']}
      },
      join: ['patient.debitor_id=debitor.id', 'debitor.group_id=debitor_group.id'],
      where: ['debitor_group.locked<>1']
    };

    currency = {
      tables : { "currency" : { columns: ["id", "symbol"] } } 
    };

    cash = {
      tables: { "cash" : { columns: ["id", "bon", "bon_num", "invoice_id", "date", "debit_account", "credit_account", "currency_id", "cashier_id", "text"] }},
    };

    cash_items = {
      tables: { 'cash_item' : { columns: ["id", "cash_id", "invoice_id", "cost"] }}, 
    };

    $q.all([
      connect.req(debitors),
      connect.req(currency),
      connect.req(cash),
      connect.req(cash_items)
    ]).then(init);

    var model_names = ['debitors', 'currency', 'cash', 'cash_items'];
    var models = $scope.models = {};
    var stores = $scope.stores = {};
    var slip = $scope.slip = {};
    var meta = $scope.meta = {};
    meta.invoices = [];

    function init (arr) {
      // init all data connections & models
      arr.forEach(function (model, idx) {
        stores[model_names[idx]] = model;
        models[model_names[idx]] = model.data;
      });
    }

    function defaults () {
      slip.id = stores.cash.generateid();

      // Module-dependent flag to say what cashbox this is
      slip.cashbox_id = 1;

      //just for the test, it will be changed
      slip.enterprise_id = enterprise_id;

      // default debit account is cash box
      slip.debit_account = cash_account;

      // default date is today
      slip.date = $filter('date')(new Date(), 'yyyy-MM-dd');

      // default currency
      slip.currency_id = 1;

      // we start up as entree
      slip.bon = "E";

      slip.bon_num = getBonNumber(models.cash, slip.bon);

      // FIXME: get this from a service
      slip.cashier_id = 1;

    }


    function selectDebitor () {
      // populate the outstanding invoices
      $http.get('/ledgers/debitor/' + meta.debitor)
        .then(function (response) {
          if (response.data) {
            models.outstanding = response.data.filter(function (row) {
              // filter only those that do not balance
              return (row.credit - row.debit > 0); 
            });
          }
        });

      slip.credit_account = stores.debitors.get(meta.debitor).account_number;
      // update the text automatically
      // This doesn't work yet.
      $scope.$watch([meta.invoices, meta.debitors, meta.amount], function () {
        // default text
        slip.text = "Payment of invoice(s) %s for patient %p totaling %a."
            .replace('%s', meta.invoices.join().toUpperCase())
            .replace('%p', stores.debitors.get(meta.debitor).first_name.toUpperCase())
            .replace('%a', meta.amount || '');
      })
      defaults();
    }

    $scope.selectDebitor = selectDebitor;

    $scope.formatCurrency = function (id) {
      // deal the the asynchronous case where store is not
      // defined.
      return (stores.currency && stores.currency.get(id)) ? stores.currency.get(id).symbol: "";
    };

    $scope.setCurrency = function (idx) {
      // store indexing starts from 0.  DB ids start from 1
      slip.currency_id = idx + 1; 
    };

    $scope.formatName = function (deb) {
      return [deb.first_name, deb.last_name].join(' ');
    };

    function createCashItems (cost) {
      var item, debt, i = 0,
          model = meta.invoices,
          store = stores.cash_items;
      while (cost > 0 && model[i]) {
        debt = model[i].credit - model[i].credit;
        item = {};
        item.id = store.generateid();
        item.cash_id = slip.id;
        item.invoice_id = model[i].id;
        item.cost = (cost - debt >= 0) ? cost - debt : debt - cost;
        cost = cost - item.cost;
        store.post(item);
        console.log("created:", item);
        i++;
      }
    }

    $scope.submit = function () {
      // clean off the object of $hashkey and the like
      var cleaned = connect.clean(slip);
      if (meta.invoices.length < 1) { 
        $scope.noinvoices = true;
        return; 
      } else {
        createCashItems(meta.amount);
        stores.cash.put(cleaned); 
      }
      // FIXME: improve this
      connect.journal([{id:slip.id, transaction_type:1, user:1}]); //a effacer just for the test
      // FIXME: make this formal for posting to the journal
      $scope.clear();
    };

    function getBonNumber (model, bon_type) {
      // filter by bon type, then gather ids.
      var ids = model.filter(function(row) {
        return row.bon === bon_type; 
      }).map(function(row) {
        return row.bon_num;
      });
      return (ids.length < 1) ? 1 : Math.max.apply(Math.max, ids) + 1;
    }

    $scope.valid = function () {
      var receipt = $scope.receipt;
      var bool = receipt.bon_num.$valid && receipt.amount.$valid && !!slip.credit_account;
      return bool; 
    };

    $scope.clear = function () {
      slip = $scope.slip = {};
      defaults();
    };

  });
angular.module('kpk.controllers').controller('creditorsController', function($scope, $q, $modal, kpkConnect){

  //initialisations
  $scope.creditor={};
  $scope.creditorExiste = 0;
  
  //populating creditors
  getCreditors();

  //populating group
  getGroups();

  //populating location
  getLocations();

  //les fonctions
  function getCreditors(){
    var req_db = {};

    req_db.e = [{t:'supplier', c:['id', 'name', 'address_1', 'address_2', 'location_id', 'creditor_id', 'email', 'fax', 'note', 'phone', 'international', 'locked']}];
    kpkConnect.get('/data/?', req_db).then(function(data){
      $scope.creditors = data;
    });
  }
  function getGroups(){
    var req_db = {};
    req_db.e = [{t:'creditor_group', c:['id', 'group_txt', 'account_id']}];
    kpkConnect.get('/data/?', req_db).then(function(data){
      $scope.groups = data;
    });
  }

  function getLocations(){
    var req_db = {};

    req_db.e = [{t:'location', c:['id', 'city', 'region']}];
    kpkConnect.get('/data/?', req_db).then(function(data){
      $scope.locations = data;
    });
  }

  $scope.showDialog = function() {
    var instance = $modal.open({
    templateUrl: "/partials/creditor/creditor-modal.html",
    backdrop: true,
    controller: function($scope, $modalInstance, selectedAcc, kpkConnect) {
      $scope.group = {};
      //populating accounts
      getAccounts();
      function getAccounts(){
        var req_db = {};
        req_db.e = [{t:'account', c:['id', 'account_number', 'account_txt']}];
        req_db.c = [{t:'account', cl:'locked', z:'=', v:0, l:'AND'}, {t:'account', cl:'account_number', z:'>=', v:400000, l:'AND'}, {t:'account', cl:'account_number', z:'<', v:500000}];
        kpkConnect.get('/data/?', req_db).then(function(data){
          $scope.accounts = data;
        });
      }       
        
      $scope.close = function() {
        $modalInstance.dismiss();
      };
      $scope.submit = function() {
        $modalInstance.close({group:$scope.group.group, account:$scope.group.account_id});
      };
    },
    resolve: {
      selectedAcc: function() {
        return 'hello';
      },
    }
    });
    instance.result.then(function(values) {
      kpkConnect.send('creditor_group', [{id:'', group_txt:values.group, account_id:values.account.id}]);
      getGroups();
    }, function() {
      //console.log('dedrick');
    });
  };

  $scope.verifyExisting = function(){
   if($scope.creditorExiste ==0){
       if($scope.creditor.name){
        if(isThere($scope.creditors, 'name', $scope.creditor.name)){
          var req_db = {};
          req_db.e = [{t:'supplier', c:['id', 'name', 'address_1', 'address_2', 'location_id', 'creditor_id', 'email', 'fax', 'note', 'phone', 'international', 'locked']}];
          req_db.c = [{t:'supplier', cl:'name', z:'=', v:$scope.creditor.name}];
          kpkConnect.get('/data/?', req_db).then(function(data){
           if(data.length>0){
            var id_promise = getCreditorGroupId(data[0].creditor_id);
            id_promise.then(function(value){
              $scope.creditor_group = getCreditorGroup(value.id);
            });
            data[0].location_id = getCreditorLocation(data[0].location_id);
            data[0].international = toBoolean(data[0].international);
            data[0].locked = toBoolean(data[0].locked);
            $scope.creditor = data[0];
            $scope.creditorExiste = 1;
           }        
          });
        }
      }
   }
  }

  $scope.fill = function(index){
    //getCreditors();
    $scope.creditorExiste = 0;
    $scope.creditor = $scope.creditors[index];
    $scope.creditor.international = toBoolean($scope.creditor.international);
    $scope.creditor.locked = toBoolean($scope.creditor.locked);
    $scope.creditor.location_id = getCreditorLocation($scope.creditors[index].location_id);
    var id_promise = getCreditorGroupId($scope.creditors[index].creditor_id);
    id_promise.then(function(value){
      $scope.creditor_group = getCreditorGroup(value.id);
    });
  }

  $scope.save = function(creditor, creditor_group){
    creditor.location_id = extractId(creditor.location_id);
    var creditor_group_id = extractId(creditor_group);
    var result = existe(creditor.id);
    result.then(function(response){
      if(response){             

        var sql_update = {t:'supplier', data:[creditor],pk:["id"]};
        kpkConnect.update(sql_update);
        $scope.creditor={};
        $scope.creditor_group = {};
        $scope.creditorExiste = 0;
        getCreditors();
      }else{
        //on insert
        var creditor_id_promise = getCreditorId(creditor_group_id);
        creditor_id_promise.then(function(value){
          creditor.creditor_id = value;
          kpkConnect.send('supplier', [creditor]);
        $scope.creditor={};
        $scope.creditor_group = {};
        $scope.creditorExiste = 0;
        getCreditors();
        });
      }
      
    });
  }

  function getCreditorId(id){
    var def = $q.defer();
    kpkConnect.send('creditor', [{id:'', creditor_group_id:id}]);
    var request = {}; 
    request.e = [{t : 'creditor', c : ['id']}];
    request.c = [{t:'creditor', cl:'id', v:'LAST_INSERT_ID()', z:'='}];
    kpkConnect.get('data/?',request).then(function(data) {
      console.log(data);
      def.resolve(data[0].id);

    });
    return def.promise;
  }

  function existe(id){
    var def = $q.defer();
    if(id){
      var request = {}; 
      request.e = [{t : 'creditor', c : ['id']}];
      request.c = [{t:'creditor', cl:'id', v:id, z:'='}];
      kpkConnect.get('data/?',request).then(function(data) {
       (data.length > 0)?def.resolve(true):def.resolve(false);    
      });
    }else{
      def.resolve(false);
    }
    return def.promise;
  }

  function toBoolean(number){
    return number>0;
  }

  function extractId(obj){
    return obj.id;
  }

  function getCreditorLocation(idLocation){
    var indice = -1;
    for(var i = 0; i<$scope.locations.length; i++){
      if($scope.locations[i].id == idLocation){
        indice = i;
        break;
      }
    }
    if (indice!=-1){
      return $scope.locations[indice];
    }else{
      return {};
    }
  }

  function getCreditorGroup(idGroup){
    var indice = -1;
    for(var i = 0; i<$scope.groups.length; i++){
      if($scope.groups[i].id == idGroup){
        indice = i;
        break;
      }
    }
    if (indice!=-1){
      return $scope.groups[indice];
    }else{
      return {};
    }
  }

  function getCreditorGroupId(idCreditor){
    var def = $q.defer();    
    var req_db = {};
    req_db.e = [{t:'creditor', c:['creditor_group_id']}];
    req_db.c = [{t:'creditor', cl:'id', z:'=', v:idCreditor}];
    kpkConnect.get('/data/?', req_db).then(function(data){
      var groupID = data[0].creditor_group_id;
      req_db.e = [{t:'creditor_group', c:['id']}];
      req_db.c = [{t:'creditor_group', cl:'id', z:'=', v:groupID}];
      kpkConnect.get('/data/?', req_db).then(function(data){
      def.resolve(data[0]);
      });
    });
    return def.promise;
  }

  function isThere(jsontab, cle, value){
    var indice = -1;
    for(var i = 0; i<jsontab.length; i++){
      if(jsontab[i][cle] == value){
        indice = i;
        break;
      }
    }
    if (indice!=-1){
      return true;
    }else{
      return false;
    }
  }

  $scope.delete = function(creditor){

    kpkConnect.delete('supplier', creditor.id);
    $scope.creditor = {};
    getCreditors();
  }
 });
angular.module('kpk.controllers').controller('exchangeRateController', function ($scope, connect) {
  var currency;

  currency = {
    tables : {
      'currency' : {
        columns: ["id", "name", "symbol", "note", "current_rate", "last_rate", "updated"]
      }
    }
  };

  var model, store, from, to;
  from = $scope.from = {};
  to = $scope.to = {};
  $scope.form = {};
  connect.req(currency).then(function (response) {
    store = response;
    $scope.currencies = response.data;
    to.data = angular.copy(response.data);
    from.data = angular.copy(response.data);
  });

  $scope.filter = function (v) {
    return v.id !== from.currency_id;
  };
  
  $scope.updateTo = function () {
    to.symbol = store.get(to.currency_id).symbol;
  };

  $scope.updateFrom = function () {
    from.symbol = store.get(from.currency_id).symbol;
  };

  $scope.getToSymbol = function () {
    var data = (store && store.get(from.currency_id)) ? store.get(from.currency_id) : {};
    return (data.id === to.currency_id) ? "" : to.symbol; 
  };
  
  $scope.submit = function () {
    // transform to MySQL date
    var date = new Date();
    var updated = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDay();
    var data = {
      id: from.currency_id,
      current_rate: from.current_rate,
      last_rate : store.get(from.currency_id).current_rate,
      updated: updated 
    };
    connect.basicPost('currency', [data], ['id']);
  };

  $scope.valid = function () {
    // OMG
    return !(!!to.currency_id && !!from.currency_id && !!from.current_rate);
  };

  $scope.label = function (curr) {
    return [curr.symbol, '|', curr.name].join(' '); 
  };

});
angular.module('kpk.controllers').controller('fiscalController', function($scope, $q, connect, appstate) { 
    $scope.active = "select";
    $scope.selected = null;
    $scope.create = false;

    $scope.new_model = {'year' : 'true'};

//    $scope.previous_fiscal

//   Temporary output vars
    var out_count = 0;

    function init() { 
      //Resposible for getting the current values of selects
      appstate.register("enterprise", function(res) { 
        loadEnterprise(res.id);
        //Reveal to scope for info display
        $scope.enterprise = res;
        console.log("Appstate returned", res);
      });

      //This isn't required - should this be included?
      appstate.register("fiscal", function(res) { 
        console.log("resolving", res);
        $scope.select(res.id);
      });
    }

    function loadEnterprise(enterprise_id) { 
      var fiscal_model = {};

      var promise = loadFiscal(enterprise_id);
      promise
      .then(function(res) { 
        fiscal_model = res;
        //FIXME: select should be a local function (returning a promise), it can then be exposed (/used) by a method on $scope
        //expose model
        $scope.fiscal_model = fiscal_model;
        //select default
        console.log("s", $scope);
        if(fiscal_model.data[0]) $scope.select(fiscal_model.data[0].id);

      })
    }

    function loadFiscal(enterprise_id) {  
      var deferred = $q.defer();
      var fiscal_query = {
        'tables' : {
          'fiscal_year' : {
            'columns' : ["id", "number_of_months", "fiscal_year_txt", "transaction_start_number", "transaction_stop_number", "start_month", "start_year", "previous_fiscal_year"]
          }
        },
        'where' : ['fiscal_year.enterprise_id=' + enterprise_id]
      }
      connect.req(fiscal_query).then(function(model) {
        deferred.resolve(model);
      });
      return deferred.promise;
    }
    

    $scope.select = function(fiscal_id) {
      if($scope.fiscal_model) { 
        fetchPeriods(fiscal_id);
        $scope.selected = $scope.fiscal_model.get(fiscal_id);
        $scope.active = "update";
      } 
    };

    $scope.delete = function(fiscal_id) { 
      //validate deletion before performing
      $scope.active = "select";
      $scope.selected = null;
      $scope.fiscal_model.delete(fiscal_id);
    };

    $scope.isSelected = function() { 
      return !!($scope.selected);
    };

    $scope.isFullYear = function() {
      if($scope.new_model.year == "true") return true;
      return false;
    }

    $scope.$watch('new_model.start', function(oval, nval) {
      if($scope.isFullYear()) updateEnd();
    })

    function updateEnd() {
      var s = $scope.new_model.start;
      if(s) {
//        Pretty gross
        var ds = new Date(s);
        var iterate = new Date(ds.getFullYear() + 1, ds.getMonth() - 1);
//        Correct format for HTML5 date element
        $scope.new_model.end = inputDate(iterate);
        console.log($scope.new_model.end);
      }

    }

    $scope.createFiscal = function() { 
      //Do some session checking to see if any values need to be saved/ flushed to server
      $scope.active = "create";
      $scope.selected = null;

      //Fetch data about previous fiscal year if it doesn't already exist

    };

    $scope.getFiscalStart = function() { 
      if($scope.period_model) {
        var t = $scope.period_model[0];
        if(t) return t.period_start;
      }
    };

    $scope.getFiscalEnd = function() {
      if($scope.period_model) { 
        var l = $scope.period_model;
        var t = l[l.length-1];
        if(t) return t.period_stop;
      }
    };


    $scope.generateFiscal = function generateFiscal(model) {
//      temporary defer
      var deferred = $q.defer();

      var enterprise = $scope.enterprise;
      var transaction_start_number, transaction_stop_number, fiscal_year_number;
      var insertId;

//      extract month data
      var start = new Date(model.start);
      var end = new Date(model.end);

//      TODO default for now
      transaction_start_number = 0;
      transaction_stop_number = 0;
      fiscal_year_number = 1;

//      Temporary output
      $scope.progress = {};

//      Validation

//      Years must be valid
      if(!(start < end)) {
        updateProgress("Start date must be before end date");
        return;
      }

//      validation complete - wrap object
      var fiscal_object = {
        enterprise_id: enterprise.id,
        number_of_months: diff_month(start, end) + 1, //hacky - change diff_month
        fiscal_year_txt: model.note,
        start_month: start.getMonth() + 1,
        start_year: start.getFullYear()
      }
      updateProgress('Fiscal year object packaged');

//      create fiscal year record in database
      var promise = getPrevious();
      promise
        .then(function(res) {
          console.log(res.previous_fiscal_year == null);
          if(res.previous_fiscal_year != null) fiscal_object.previous_fiscal_year = res.previous_fiscal_year;
          return putFiscal(fiscal_object);
        })
        .then(function(res) {

//        generate periods and write records to database
          insertId = res.data.insertId;
          return generatePeriods(insertId, start, end);
        }).then(function(res) {
          updateProgress("[Transaction Success] All required records created");
//          TODO add to local model temporarily, commit to server should be made through local model
          fiscal_object.id = insertId;
          $scope.fiscal_model.post(fiscal_object);
          deferred.resolve();

          // generate budget for account/ period
          // ?generate period totals
          
          //Reset model
          $scope.new_model = {};

          //Select year
          $scope.select(fiscal_object.id);
          $scope.progress = {};
        });

        return deferred.promise;
    }

    function getPrevious() {
      var deferred = $q.defer();

      connect.basicGet("/fiscal/101/")
        .then(function(res) {
          deferred.resolve(res.data);
        });

      return deferred.promise;
    }

    function putFiscal(fiscal_object) {
      var deferred = $q.defer();
      connect.basicPut('fiscal_year', [fiscal_object])
        .then(function(res) {
          updateProgress('Record created in "fiscal_year" table');
          deferred.resolve(res);
        });
//      create budget records assigned to periods and accounts

//      create required monthTotal records

      return deferred.promise;
    }

    function generatePeriods(fiscal_id, start, end) {
      var deferred = $q.defer();
      //      create period records assigned to fiscal year
      //201308
      var request = [];
      var total = diff_month(start, end) + 1;
      for(var i = 0; i < total; i++) {
//        oh lawd, so many Dates
        var next_month = new Date(start.getFullYear(), start.getMonth() + i);
        var max_month = new Date(next_month.getFullYear(), next_month.getMonth() + 1, 0);

        var period_start = mysqlDate(next_month);
        var period_stop = mysqlDate(max_month);

        var period_object = {
          fiscal_year_id: fiscal_id,
          period_start: period_start,
          period_stop: period_stop
        }
        updateProgress('Period object ' + period_start + ' packaged');
        request.push(connect.basicPut('period', [period_object]));
      }
      updateProgress('Request made for [' + request.length + '] period records');

      $q.all(request)
        .then(function(res) {
          updateProgress('All period records written successfully');
          deferred.resolve(res);
        })


      return deferred.promise;
    }

    function fetchPeriods(fiscal_id) {
      var period_query = {
        'tables' : {
          'period' : {
            'columns' : ["id", "period_start", "period_stop"]
          }
        },
        'where' : ['period.fiscal_year_id=' + fiscal_id]
      }
      connect.req(period_query).then(function(model) {
        $scope.period_model = model.data;
      });
    }

//  Utilities
    function diff_month(d1, d2) {
//      ohgawd rushing
      var res;

//      Diff months
      res = d2.getMonth() - d1.getMonth();

//      Account for year
      res += (d2.getFullYear() - d1.getFullYear()) * 12;
      res = Math.abs(res);
      return res <=0 ? 0 : res;
    }

  function inputDate(date) {
    //Format the current date according to RFC3339 (for HTML input[type=="date"])
    return date.getFullYear() + "-" + ('0' + (date.getMonth() + 1)).slice(-2);
  }

  function mysqlDate(date) {
    return date.getFullYear() + "-" + ('0' + (date.getMonth() + 1)).slice(-2) + "-" + ('0' + date.getDate()).slice(-2);
  }

  function updateProgress(body) {
    if(!$scope.progress) $scope.progress = {};
    out_count++;
    $scope.progress[out_count] =  body;
  }

    //Initialise after scope etc. has been set
    init();
  });
angular.module('kpk.controllers').controller('inventoryController', function($scope) {
 
    $scope.fields = {
      'stock'  : false,
      'admin'  : false,
      'report' : false
    };

    $scope.slide = function (tag) {
      $scope.fields[tag] = !$scope.fields[tag];
    };
  });
angular.module('kpk.controllers').controller('inventoryRegisterController', function ($scope, appstate, connect, $q, $modal) {

    var account_defn, inv_unit_defn, inv_group_defn, inv_defn, inv_type_defn;
    var eid = appstate.get('enterprise').id;

    account_defn= {
      tables: {'account': {columns: ['enterprise_id', 'id', 'account_number', 'locked', 'account_txt', 'account_type_id']}},
      where: ["account.enterprise_id=" + eid]
    };

    inv_unit_defn = {
      tables : {'inv_unit': { columns: ["id", "text"] }}
    };

    inv_group_defn = {
      tables: {'inv_group': { columns: ['id', 'name', 'symbol', 'sales_account', 'cogs_account', 'stock_account', 'tax_account']}}
    };

    inv_defn = {
      tables: {'inventory': { columns: ['enterprise_id', 'id', 'code', 'text', 'price', 'group_id', 'unit_id', 'unit_weight', 'unit_volume', 'stock', 'stock_max', 'stock_min', 'consumable']}},
      where: ["inventory.enterprise_id=" + eid]
    };

    inv_type_defn = {
      tables: {'inv_type': { columns: ['id', 'text']}}
    };
    initia();
    function initia(){
      $q.all([
      connect.req(account_defn),
      connect.req(inv_unit_defn),
      connect.req(inv_group_defn),
      connect.req(inv_type_defn),
      connect.req(inv_defn)
    ]).then(init);
    }

    

    var stores = {},
      models = ['account', 'inv_unit', 'inv_group', 'inv_type', 'inventory'],
      item;
    $scope.models = {};
    $scope.item = item = {};

    function init(arr) {
      for (var i = 0, l = arr.length; i < l; i++) {
        stores[models[i]] = arr[i];
        $scope.models[models[i]] = arr[i].data;
      }

      item.unit_weight = 0;
      item.unit_volume = 0;
      item.enterprise_id = eid; //101; // FIXME: maybe
      //console.log('line 2144', stores.account); console.log('line 2144', stores.inv_unit);
      //console.log($scope.models.account);
    }


    function reset () {
      $scope.item = item = {};
      item.unit_weight = 0;
      item.unit_volume = 0;
    }

    $scope.submit = function () {
      if ($scope.inventory.$valid) {
        item.id = stores.inventory.generateid(); 
        stores.inventory.put(item);
        console.log("line 2151 controllerjs item:", item);
        item.enterprise_id = appstate.get("enterprise").id;
        connect.basicPut('inventory', [item]);
        reset();
      } else {
        for (var k in $scope.inventory) {
          if ($scope.inventory[k].$invalid) {
            $scope.invalid[k] = "true"; 
            // TODO: make css classes depend on this. Color
            // red for error on each input if $invalid.
          } 
        }
      }
    };

    $scope.logStore = function () {
      console.log(stores.inv_group.data); 
    };

    // New Type Instance Modal/Controller
    $scope.newUnitType = function () {
      var instance = $modal.open({
        templateUrl: 'unitmodal.html',
        controller: function($scope, $modalInstance, unitStore) {
          var unit = $scope.unit = {};
          $scope.units = unitStore.data;
          console.log('line 2177 units', unitStore);

          $scope.submit = function () {
            // validate
            $scope.unit.id = unitStore.generateid();
            if (unit.text) {
              // process
              var text = unit.text.toLowerCase();
              text = text[0].toUpperCase() + text.slice(1);
              unit.text = text;

              /*unitStore.put(unit);
              connect.basicPut('inv_unit', [{id: unit.id, text: unit.text}]); //FIXME: AUGHAUGH*/
              $modalInstance.close({id: unit.id, text: unit.text});
            }
          };

          $scope.discard = function () {
            $modalInstance.dismiss(); 
          };

        },
        resolve: {
          unitStore: function() { return stores.inv_unit; }
        }
      });

      instance.result.then(function (value) {
        //unitStore.put(unit);
        connect.basicPut('inv_unit', [value]);
        initia();
        //console.log("Submitted Successfully.");
      }, function () {
        console.log("Closed Successfully."); 
      });
    };

    $scope.newInventoryGroup = function () {
      var instance = $modal.open({
        templateUrl: "inventorygroupmodal.html",
        controller: function ($scope, $modalInstance, groupStore, accountModel) {
          var group = $scope.group = {},
            clean = {},
            cols = ["id", "name", "symbol", "sales_account", "cogs_account", "stock_account", "tax_account"];

          $scope.accounts = accountModel;

          $scope.submit = function () {
            group.id = groupStore.generateid();
            cols.forEach(function (c) { clean[c] = group[c]; }); // FIXME: AUGHGUGHA            
            groupStore.put(group);
            //fix me for writting this in a good way
            clean.sales_account = clean.sales_account.account_number;
            clean.cogs_account = clean.cogs_account.account_number;
            clean.stock_account = clean.stock_account.account_number;
            clean.tax_account = clean.tax_account.account_number;
            connect.basicPut('inv_group', [clean]);
            $modalInstance.close();
          };

          $scope.discard = function () {
            $modalInstance.dismiss(); 
          };

        },
        resolve: {
          groupStore: function () { return stores.inv_group; },
          accountModel: function () { return $scope.models.account; }
        }
      });

      instance.result.then(function () {
        console.log("Submitted Successfully.");
      }, function () {
        console.log("Closed Successfully."); 
      });
    };

    $scope.reset = function () {
      reset();
    };

  });
angular.module('kpk.controllers').controller('journalController', function($scope, $translate, $compile, $timeout, $q, $modal, connect){

  $scope.model = {};
  $scope.model['journal'] = {'data' : []};

//  Request
  var journal_request = {
    'tables' : {
      'posting_journal' : {
        'columns' : ["id", "trans_id", "trans_date", "doc_num", "description", "account_id", "debit", "credit", "currency_id", "deb_cred_id", "deb_cred_type", "inv_po_id", "debit_equiv", "credit_equiv"]
      }
    }
  }

  //TODO iterate thorugh columns array - apply translate to each heading and update
  //(each should go through translate initially as well)
  $scope.$on('$translateChangeSuccess', function () {
    //grid.updateColumnHeader("trans_id", $translate('GENERAL_LEDGER'));
  });

//  grid options
  var grid;
  var dataview;
  var sort_column = "trans_id";
  var columns = [
    {id: 'trans_id', name: "ID", field: 'trans_id', sortable: true},
    {id: 'trans_date', name: 'Date', field: 'trans_date'},
    {id: 'doc_num', name: 'Doc No.', field: 'doc_num', maxWidth: 75},
    {id: 'description', name: 'Description', field: 'description', width: 110},
    {id: 'account_id', name: 'Account ID', field: 'account_id', sortable: true},
    {id: 'debit', name: 'Debit', field: 'debit', groupTotalsFormatter: totalFormat, sortable: true, maxWidth:100},
    {id: 'credit', name: 'Credit', field: 'credit', groupTotalsFormatter: totalFormat, sortable: true, maxWidth: 100},
    {id: 'deb_cred_id', name: 'AR/AP Account', field: 'deb_cred_id'},
    {id: 'deb_cred_type', name: 'AR/AP Type', field: 'deb_cred_type'},
    {id: 'inv_po_id', name: 'Inv/PO Number', field: 'inv_po_id'},
    {id: 'del', name: '', width: 10, formatter: formatBtn}
  ];
  var options = {
    enableCellNavigation: true,
    enableColumnReorder: true,
    forceFitColumns: true,
    rowHeight: 30
  };

  function init() {

    connect.req(journal_request).then(function(res) {
      $scope.model['journal'] = res;

      var groupItemMetadataProvider = new Slick.Data.GroupItemMetadataProvider();
      dataview = new Slick.Data.DataView({
        groupItemMetadataProvider: groupItemMetadataProvider,
        inlineFilter: true
      });
      grid = new Slick.Grid('#journal_grid', dataview, columns, options);

      grid.registerPlugin(groupItemMetadataProvider);
//      Cell selection
//      grid.setSelectionModel(new Slick.CellSelectionModel());

      grid.onSort.subscribe(function(e, args) {
        sort_column = args.sortCol.field;
        dataview.sort(compareSort, args.sortAsc);
      })

      dataview.onRowCountChanged.subscribe(function (e, args) {
        grid.updateRowCount();
        grid.render();
      });

      dataview.onRowsChanged.subscribe(function (e, args) {
        grid.invalidateRows(args.rows);
        grid.render();
      });



//      Set for context menu column selection
//      var columnpicker = new Slick.Controls.ColumnPicker(columns, grid, options);

      dataview.beginUpdate();
      dataview.setItems($scope.model['journal'].data);
//      $scope.groupByID()
      dataview.endUpdate();
      console.log("d", dataview);
      console.log("d.g", dataview.getItems());

    })

  }

  $scope.groupByID = function groupByID() {
    dataview.setGrouping({
      getter: "trans_id",
      formatter: function (g) {
        return "<span style='font-weight: bold'>" + g.value + "</span> (" + g.count + " transactions)</span>";
      },
      aggregators: [
        new Slick.Data.Aggregators.Sum("debit"),
        new Slick.Data.Aggregators.Sum("credit")
      ],
      aggregateCollapsed: false
    });
  }

  $scope.groupByAccount = function groupByAccount() {
    dataview.setGrouping({
      getter: "account_id",
      formatter: function(g) {
        return "<span style='font-weight: bold'>" + g.value + "</span>"
      },
      aggregators: [
        new Slick.Data.Aggregators.Sum("debit"),
        new Slick.Data.Aggregators.Sum("credit")
      ],
      aggregateCollapsed: false
    });
  }

  $scope.removeGroup = function removeGroup() {
    dataview.setGrouping({});
  }

  function compareSort(a, b) {
    var x = a[sort_column], y = b[sort_column];
    return (x == y) ? 0 : (x > y ? 1 : -1);
  }

  function formatBtn() {
    return "<a class='ng-scope' ng-click='splitTransaction()'><span class='glyphicon glyphicon-th-list'></span></a>";
  }

  function totalFormat(totals, column) {

    var format = {};
    format['Credit'] = '#02BD02';
    format['Debit'] = '#F70303';

    var val = totals.sum && totals.sum[column.field];
    if (val != null) {
      return "<span style='font-weight: bold; color:" + format[column.name] + "'>" + ((Math.round(parseFloat(val)*100)/100)) + "</span>";
    }
    return "";
  }

  $scope.splitTransaction = function splitTransaction() {
    console.log("func is called");
    var instance = $modal.open({
      templateUrl: "split.html",
      controller: function ($scope, $modalInstance) { //groupStore, accountModel
        console.log("Group module initialised");

      },
      resolve: {
        //groupStore: function () { return stores.inv_group; },
        //accountModel: function () { return $scope.models.account; }
      }
    });
  }

  //good lawd hacks
  //FIXME: without a delay of (roughly)>100ms slickgrid throws an error saying CSS can't be found
//  $timeout(init, 100);


  init();
});
angular.module('kpk.controllers').controller('appController', function($scope, $location, appcache) { 
    
    //Cache URL's to maintain user session
    var url = $location.url();

    //Assuming initial page load
    if (url === '') {
      //only navigate to cached page if no page was requested
      appcache.getNav().then(function(res) {
        if(res) {
          $location.path(res);
        }
      });
    }
    
    $scope.$on('$locationChangeStart', function(e, n_url) { 
      //Split url target - needs to be more general to allow for multiple routes?
      var target = n_url.split('/#')[1];
      if(target) appcache.cacheNav(target);
    });
});
angular.module('kpk.controllers').controller('treeController', function($scope, $q, $location, appcache, kpkConnect) {    
    var deferred = $q.defer();
    var result = getRoles();
    $scope.treeData = [];
    var cb = function(role, units){
      var element = {};
      element.label = role.name;
      element.id = role.id;
      element.children = [];

//      Set default element state
      element.collapsed = true;
//      console.log(appcache.checkDB());

      for(var i = 0; i<units.length; i++){
        element.children.push({"label":units[i].name, "id":units[i].id, "p_url":units[i].p_url, "children":[]});
      }
      $scope.treeData.push(element);

    };

    result.then(function(values){
      for(var i = 0; i<values.length; i++){
        getChildren(values[i], cb);
      }
    });
 
    
    $scope.$watch('navtree.currentNode', function( newObj, oldObj ) {
        if( $scope.navtree && angular.isObject($scope.navtree.currentNode) ) {
            $location.path($scope.navtree.currentNode.p_url);
        }
    }, true);

    function getRoles(){
      var request = {}; 
      request.e = [{t : 'unit', c : ['id', 'name']}];
      request.c = [{t:'unit', cl:'parent', v:0, z:'='}];
      kpkConnect.get('/tree?',request).then(function(data) { 
        deferred.resolve(data);
      });
      return deferred.promise;
    }

    function getChildren(role, callback){
      var request = {}; 
      request.e = [{t : 'unit', c : ['id', 'name', 'url']}];
      request.c = [{t:'unit', cl:'parent', v:role.id, z:'='}];
      kpkConnect.get('/tree?',request).then(function(data) {
          callback(role, data); 
        
      });

    };

});
angular.module('kpk.controllers').controller('utilController', function($scope, $translate) { 
  ////
  // summary: 
  //  Responsible for all utilities (buttons/ selects etc.) on the application side bar
  /////

  $scope.toggleTranslate = function toggleTranslate(lang_key) { 
    $translate.uses(lang_key);
  }
  
  //removed select code - downloaded Enterprises/Fiscal Years and populated selects
});
angular.module('kpk.controllers').controller('patientRegController', function($scope, $q, $location, connect, $modal, kpkConnect, appstate) {
    console.log("Patient init");
    var patient_model = {};
    var submitted = false;
    var default_patientID = 1;


    function init() { 
      //register patient for appcahce namespace
      var default_group = 3 //internal patient

      var location_request = connect.req({'tables' : {'location' : {'columns' : ['id', 'city', 'region']}}});
      //This was if we needed to create alpha-numeric (specific) ID's
      var patient_request = connect.req({'tables' : {'patient' : {'columns' : ['id']}}});
      //Used to generate debtor ID for patient
      //      FIXME just take the most recent items from the database, vs everything?
      var debtor_request = connect.req({'tables' : {'debitor' : {'columns' : ['id']}}});
      var debtor_group_request = connect.req({'tables' : {'debitor_group' : {'columns' : ['id', 'name', 'note']}}});

      $q.all([location_request, patient_request, debtor_request, debtor_group_request])
      .then(function(res) { 
        $scope.location_model = res[0];
        $scope.patient_model = res[1];
        $scope.debtor_model = res[2];
        $scope.debtor_group_model = res[3];
        //$scope.location = $scope.location_model.data[0]; //select default

        $scope.debtor = {};
        //$scope.debtor.debtor_group = $scope.debtor_group_model.get(default_group);
      });
    }

    function createId(data) {
      console.log(data);
      if(data.length===0) return default_patientID;
      var search = data.reduce(function(a, b) { a = a.id || a; return Math.max(a, b.id)});
      console.log("found", search);
      // quick fix
      search  = (search.id !== undefined) ? search.id : search;
      //if(search.id) search = search.id;
      return search + 1;
    }

    $scope.update = function(patient) {
      //      download latest patient and debtor tables, calc ID's and update
      var patient_request = connect.req({'tables' : {'patient' : {'columns' : ['id']}}});
      var debtor_request = connect.req({'tables' : {'debitor' : {'columns' : ['id']}}});

      var patient_model, debtor_model;

      //      TODO verify patient data is valid

      $q.all([debtor_request, patient_request])
        .then(function(res) {
          debtor_model = res[0];
          patient_model = res[1];


          patient.id = createId(patient_model.data);
          patient.debitor_id = createId(debtor_model.data);
          console.log("created p_id", patient.id);
          console.log("created id", patient.debitor_id);

          commit(patient);
        });
    }

    function commit(patient) {

      var debtor = $scope.debtor;
      patient_model = patient;

      var format_debtor = {id: patient_model.debitor_id, group_id: $scope.debtor.debtor_group.id};
      console.log("requesting debtor", format_debtor);
      //Create debitor record for patient - This SHOULD be done using an alpha numeric ID, like p12
      // FIXME 1 - default group_id, should be properly defined
      connect.basicPut("debitor", [format_debtor])
      .then(function(res) { 
        //Create patient record
        console.log("Debtor record added", res);
        connect.basicPut("patient", [patient_model])
        .then(function(res) {
          $location.path("patient_records/" + res.data.insertId);
          submitted = true;
        });
      });

    };

    $scope.formatLocation = function(l) { 
      return l.city + ", " + l.region;
    }

    $scope.checkChanged = function(model) { 
        return angular.equals(model, $scope.master);
    };

    $scope.checkSubmitted = function() { 
      return submitted;
    };

    function getGroups(){
      var req_db = {};
      req_db.e = [{t:'debitor_group', c:['id', 'name']}];
      req_db.c = [{t:'debitor_group', cl:'locked', z:'=', v:0}];
      kpkConnect.get('/data/?', req_db).then(function(data){
        $scope.debtor_group_model.data = data;
      });
      
    }

    $scope.createGroup = function () {
      var instance = $modal.open({
        templateUrl: "debtorgroupmodal.html",
        controller: function ($scope, $modalInstance) { //groupStore, accountModel
          console.log("Group module initialised");
          $scope.group = {};
          getAccounts();
          getLocations();
          getPayments();
          getTypes();
          function getAccounts(){
            var req_db = {};
            req_db.e = [{t:'account', c:['id', 'account_number','account_txt']}];
            req_db.c = [{t:'account', cl:'locked', z:'=', v:0, l:'AND'}, {t:'account', cl:'account_number', z:'>=', v:400000, l:'AND'}, {t:'account', cl:'account_number', z:'<', v:500000}];
            kpkConnect.get('/data/?', req_db).then(function(data){
              $scope.accounts = data;
            });
          }

          function getLocations(){
            var req_db = {};
            req_db.e = [{t:'location', c:['id', 'city', 'region']}];
            kpkConnect.get('/data/?', req_db).then(function(data){
            $scope.locations = data;
            });
          }

          function getPayments(){
            var req_db = {};
            req_db.e = [{t:'payment', c:['id', 'text']}];
            kpkConnect.get('/data/?', req_db).then(function(data){
            $scope.payments = data;
            });
          }

          function getTypes(){
            var req_db = {};
            req_db.e = [{t:'debitor_group_type', c:['id', 'type']}];
            kpkConnect.get('/data/?', req_db).then(function(data){
            $scope.types = data;
            });
          }

          $scope.submit = function(){
            $modalInstance.close($scope.group);
          }

          $scope.discard = function () {
            $modalInstance.dismiss();
          };
          /*var group = $scope.group = {},
            clean = {},
            cols = ["id", "name", "symbol", "sales_account", "cogs_account", "stock_account", "tax_account"];

          $scope.accounts = accountModel;

          $scope.submit = function () {
            group.id = groupStore.generateid();
            cols.forEach(function (c) { clean[c] = group[c]; }); // FIXME: AUGHGUGHA
            groupStore.put(group);
            connect.basicPut('inv_group', [clean]);
            $modalInstance.close();
          };*/

          

        },
        resolve: {
          //groupStore: function () { return stores.inv_group; },
          //accountModel: function () { return $scope.models.account; }
        }
      });
      instance.result.then(function(value) {
        //kpkConnect.send('creditor_group', [{id:'', group_txt:values.group, account_id:values.account.id}]);
        //getGroups();
        console.log(value);
        value.enterprise_id = appstate.get("enterprise").id;
        value.account_number = value.account_number.account_number;
        value.type_id = value.type_id.id;
        value.location_id = value.location_id.id;
        value.payment_id = value.payment_id.id;
        kpkConnect.send('debitor_group', [value]);
        getGroups();

    }, function() {
      console.log('dedrick');
    });
    }


    init();
  });
angular.module('kpk.controllers').controller('priceListController', function ($scope, $q, connect, appstate) {
  var pln, pl, grp, inv, eid, models, validate, stores, dirty, flags, dependencies, changes;

  // FIXME: Eventually move away form this method of getting enterprise id
  // so that we can refresh when the enterprise changes
  eid = appstate.get('enterprise').id;

  // price list names
  pln = {
    tables: { 'price_list_name' : { columns :  ["id", "name"] }},
    where : ["price_list_name.enterprise_id="+eid]
  };

  // inventory
  inv = {
    tables : { 'inventory' : { columns: ["id", "code", "text"] }} 
  };
  
  // inventory group
  grp = { 
    tables : { 'inv_group' : { columns: ["id", "name", "symbol"] }}
  };

  // price list 
  pl = {
    tables: { 'price_list' : { columns : ["id", "list_id", "inventory_id", "price", "discount", "note"] }},
    where : []
  };

  // initialize models
  models       = $scope.models = {};
  flags        = $scope.flags  = {};
  dirty        = $scope.dirty  = {};
  validate     = $scope.validate = {};
  flags.edit   = {};
  flags.errors = {};
  stores       = {};
  dependencies = ["plnames", "inv", "grp"];

  $q.all([
    connect.req(pln),
    connect.req(inv),
    connect.req(grp)
  ]).then(function (arr) {
    // load dependencies
    for (var i = arr.length - 1; i >= 0; i--) {
      models[dependencies[i]] = arr[i].data;
      stores[dependencies[i]] = arr[i];
    }
    flags.edit.list = Infinity;
  });

  // List controls

  // create a new price list
  $scope.addList = function () {
    var id, list;
    id = stores.plnames.generateid();
    list = {id: id};
    stores.plnames.put(list);
    // after creating, immediately edit
    $scope.editList(id);
  };

  // validate and save
  $scope.saveList = function () {
    var id = flags.edit.list;
    var list = stores.plnames.get(id);
    if (!validate.list(list)) stores.plnames.delete(id);
    else {
      list.enterprise_id = eid;
      connect.basicPut('price_list_name', [list]);
    }
    flags.edit.list = Infinity;
  };

  // edit a list
  $scope.editList = function (id) {
     flags.edit.list = id;
  };

  // load a specific price list
  $scope.loadList = function (id) {
    if (flags.edit.list === Infinity) {
      console.log("loading list");
      pl.where = ["price_list.list_id=" + id];
      connect.req(pl).then(function (res) {
        models.pl = res.data;
        stores.pl = res;
      });
      flags.list = id;
      flags.add = true;
    }
  };

  // Item controls
  
  // remove an item from the price list
  $scope.removeItem = function (id) {
    flags.add = true;
    stores.pl.delete(id);
  };

  // add an item to the price list
  $scope.addItem = function () {
    var id = stores.pl.generateid();
    stores.pl.put({id: id, list_id: flags.list});
    $scope.editItem(id);
  };
 
  // edit an item in the price list 
  $scope.editItem = function (id) {
    flags.edit.item = id;
    flags.add = false;
  };

  // label the inventory properly
  $scope.label = function (invid) {
    // sometimes it is not defined
    var item = invid ? stores.inv.get(invid) : {};
    return (item && item.text) ? item.text : "";
  };

  // validate and exit editing
  $scope.saveEdit = function () {
    var item = stores.pl.get(flags.edit.item);
    if (validate.item(item)) { 
      flags.edit.item = Infinity; 
      flags.add = true;
    }
  };

  // filter controls
  $scope.filter = function (id) {
    flags.filter = id >= 0 ? stores.grp.get(id).symbol : "";
    refreshInventory();
  };

  function refreshInventory () {
    var inv = { tables : { 'inventory' : { columns: ["id", "code", "text"] }}};
    if (flags.filter) {
      inv.where = ["inventory.group_id="+flags.filter];
    }
    connect.req(inv).then(function (res) {
      models.inv = res.data;
      stores.inv = res;
    });
  }

  // validation

  // validate item
  validate.item = function (item) {
    // an item must have ether a price or a 
    // discount, but not both
    var bool = !!item.id && !!item.inventory_id && ((!!item.price || !!item.discount) && !(!!item.price && !!item.discount));
    return bool;
  };

  validate.list = function (list) {
    // a list must have all fields filled out
    var bool = !!list.id && !!list.name;
    return bool;
  };

  // form controls

  $scope.save = function () {
    // TODO: do all this with connect
    // stores
    function clean (obj) {
      var cln = {};
      for (var k in obj) {
        if (k !== "hashkey") {
          cln[k] = obj[k]; 
        } 
      }
      return cln;
    }

    var data = models.pl.map(clean);
    console.log("saving:", data);
    connect.basicPut('price_list', data);
  };

  $scope.erase = function () {
    // TODO: add a user warning before doing this..
    models.pl.forEach(function (i) {
      stores.pl.delete(i.id); 
    });
  };

});
angular.module('kpk.controllers').controller('purchaseOrderController', function($scope, $q, connect, appstate, appnotify) {
  console.log("Inventory invoice initialised");

//  FIXME There is a lot of duplicated code for salesController - is there a better way to do this?
//  FIXME Resetting the form maintains the old invoice ID - this causes a unique ID error, resolve this
  $scope.sale_date = getDate();
  $scope.inventory = [];

  $scope.process = ["PO", "QUOTE"];
  $scope.current_process = $scope.process[0];

  $scope.purchase_order = {payable: "false"};

  var inventory_query = {
    'tables' : {
      'inventory' : {
        'columns' : [
          'id',
          'code',
          'text',
          'price',
          'type_id'
        ]
      }
    },
    'where' : [
      'inventory.type_id=0'
    ]
  }
  var inventory_request = connect.req(inventory_query);


  var max_sales_request = connect.basicGet('/max/id/sale');
  var max_purchase_request = connect.basicGet('/max/id/purchase');

  var creditor_query = {
    'e' : [{
      t : 'supplier',
      c : ['id', 'name', 'location_id', 'creditor_id']
    }, {
      t : 'location',
      c : ['city', 'region', 'country_id']
    }],
    'jc' : [{
      ts : ['location', 'supplier'],
      c : [ 'id', 'location_id']
    }]
  };

  var creditor_request = connect.basicReq(creditor_query);
  var user_request = connect.basicGet("user_session");

  function init() {

    $scope.inventory = [];
    $scope.purchase_order.payable = "false";
    $scope.creditor = "";

    $q.all([
      inventory_request,
      // sales_request,
      // purchase_request,
      max_sales_request,
      max_purchase_request,
      creditor_request,
      user_request

    ]).then(function(a) {
      $scope.inventory_model = a[0];
      $scope.max_sales = a[1].data.max;
      $scope.max_purchase = a[2].data.max;
      $scope.creditor_model = a[3];
      $scope.verify = a[4].data.id;

//      Raw hacks - #sorry, these might be the same entity anyway
      var id = Math.max($scope.max_sales, $scope.max_purchase);
      $scope.invoice_id = createId(id);
    });
  }

  function getDate() {
    //Format the current date according to RFC3339 (for HTML input[type=="date"])
    var now = new Date();
    return now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + ('0' + now.getDate()).slice(-2);
  }

  function createId(current) {
    /*
    *summary 
    *  Format and increment according to transaction ID format
    */
    var default_id = 100000;
    if(!current) return default_id;
    return current+1;
  }

  function formatInvoice() {
    var t = 0;
    for(var i= 0, l = $scope.inventory.length; i < l; i++) {
      t += $scope.inventory[i].quantity * $scope.inventory[i].price;
    }
//    verify total

    var format = {
      enterprise_id : appstate.get("enterprise").id, //Not async safe - may return null
      id : $scope.invoice_id,
      cost : t,
      currency_id : 1, // FIXME
      creditor_id : $scope.creditor.id,
      invoice_date : $scope.sale_date,
      purchaser_id : $scope.verify,
      note : $scope.formatText(),
      posted : '0'
    };
//    verify format
    return format;
  }

  function generateItems() {
    var deferred = $q.defer();
    var promise_arr = [];

    //iterate through invoice items and create an entry to sale_item
    $scope.inventory.forEach(function(item) {
      var format_item = {
        purchase_id : $scope.invoice_id,
        inventory_id : item.item.id,
        quantity : item.quantity,
        unit_price : item.price,
        total : item.quantity * item.price
      };
      console.log("Generating sale item for ", item);

      promise_arr.push(connect.basicPut('purchase_item', [format_item]));
    });

    $q.all(promise_arr).then(function(res) { deferred.resolve(res)});
    return deferred.promise;
  }

  $scope.submitPurchase = function() {
    var purchase = formatInvoice();

    console.log("Posting", purchase, "to 'purchase table");

    connect.basicPut('purchase', [purchase])
      .then(function(res) {
        if(res.status==200) {
          var promise = generateItems();
          promise
            .then(function(res) {
              console.log("Purchase order successfully generated", res);
              connect.journal([{id:$scope.invoice_id, transaction_type:3, user:1}]); //just for the test, send data to the journal traget server-side
//              Navigate to Purchase Order review || Reset form
//              Reset form
                init();

            });
        }
      });
  }

  $scope.updateItem = function(item) {

    if(item.item) {
      if(!item.quantity) item.quantity = 1;
      item.text = item.item.text;
      item.price = item.item.price;
    } else {
//      Reset
      item.text = "";
      item.price = "";
      item.quantity = "";
    }
  }

  $scope.updateInventory = function() {
    $scope.inventory.push({});
  }

  $scope.formatText = function() {
//      FIXME String functions within digest will take hours and years
    var c = "PO " + $scope.invoice_id + "/" + $scope.sale_date;
    if($scope.creditor) c += "/" + $scope.creditor.name + "/";
    return c;
  }



//  Radio inputs only accept string true/false? boolean value as payable doesn't work
  $scope.isPayable = function() {
    if($scope.purchase_order.payable=="true") return true;
    return false;
  };

  // FIXME Again - evaluated every digest, this is a bad thing
  $scope.invoiceTotal = function() {
    var total = 0;
    $scope.inventory.forEach(function(item) {
      if(item.quantity && item.price) {
        //FIXME this could probably be calculated less somewhere else (only when they change)
        total += (item.quantity * item.price);
      }
    });
    return total;
  }

  $scope.itemsInInv = function() {
    if($scope.inventory.length>0) return true;
    return false;
  }

  $scope.select = function(index) {
    $scope.current_process = $scope.process[index];
  }

  $scope.formatCreditor = function(creditor) {
    return creditor.name;
  }

  init();


});
angular.module('kpk.controllers').controller('patientRecordsController', function($scope, $q, $routeParams, connect) {
    console.log("Patient Search init");

    var patient = ($routeParams.patientID || -1);


    function init() { 
      var promise = fetchRecords();

      $scope.patient_model = {};
      $scope.selected = null;
      $scope.patient_filter = {};

      promise
      .then(function(model) { 
        //FIXME configure locally, then expose
        
        //expose scope 
        $scope.patient_model = filterNames(model); //ng-grid
        //Select default
        if(patient>0) $scope.select(patient);

      }); 
    }

    function fetchRecords() { 
      var deferred = $q.defer();

      $scope.selected = {};

      connect.req({'tables' : {'patient' : {'columns' : ['id', 'first_name', 'last_name', 'dob', 'parent_name', 'sex', 'religion', 'marital_status', 'phone', 'email', 'addr_1', 'addr_2']}}})
        .then(function(model) {
        deferred.resolve(model);
      });

      return deferred.promise;
    }

    function filterNames(model) { 
      var d = model.data;
      for(var i=0, l=d.length; i<l; i++) { 
        d[i]["name"] = d[i].first_name + " " + d[i].last_name;
      }
      return model;
    }

    $scope.select = function(id) { 
      $scope.selected = $scope.patient_model.get(id);
    }

    init();
  });
angular.module('kpk.controllers').controller('purchaseRecordsController', function($scope, $q, $routeParams, connect) {

    var default_purchase = ($routeParams.purchaseID || -1);
    
    function init() {

      $scope.selected = null;

      var promise = fetchRecords();
      promise
        .then(function(model) {
          //expose scope
          $scope.purchase_model = model;
          //Select default
          if(default_purchase>0) $scope.select(default_purchase);

        });

      $scope.post = function() {
        console.log("Request for post");
//        This could be an arry
        var selected = $scope.selected;
        var request = [];
        /* support multiple rows selected
         if(selected.length>0) {
         selected.forEach(function(item) {
         if(item.posted==0) {
         request.push(item.id);
         }
         });
         }*/
        if(selected) request.push(selected.id);
        //if(selected) request.push({transact ion_id:1, service_id:1, user_id:1});

        connect.journal(request)
          .then(function(res) {
            console.log(res);
//            returns a promise
            if(res.status==200) invoicePosted(request);
          });

        console.log("request should be made for", request);
      }
    }

    $scope.select = function(id) {
      $scope.selected = $scope.purchase_model.get(id);
      console.log('selected', $scope.selected);
    }

    function invoicePosted(ids) {
      var deferred = $q.defer();
      var promise_update = [];
      /*summary
       *   Updates all records in the database with posted flag set to true
       */
      ids.forEach(function(invoice_id) {
        var current_invoice = $scope.invoice_model.get(invoice_id);
        console.log("Updating 'posted'", invoice_id, current_invoice);
        current_invoice.posted = 1;
        promise_update.push(connect.basicPost("sale", [current_invoice], ["id"]));
      });

      console.log(promise_update);
      $q.all(promise_update)
        .then(function(res) {
          console.log("All ids posted");
          deferred.resolve(res);
        });

      return deferred.promise;
    }

    function fetchRecords() {
      var deferred = $q.defer();

      $scope.selected = {};

      connect.req({'tables' : {'purchase' : {'columns' : ['id', 'cost', 'currency_id', 'creditor_id', 'discount', 'invoice_date', 'posted']}}})
        .then(function(model) {
          deferred.resolve(model);
        });

      return deferred.promise;
    }


    init();
  });
angular.module('kpk.controllers').controller('salesRecordsController', function($scope, $q, $routeParams, connect) { 
    console.log("Sale records initialised");

    var default_invoice = ($routeParams.recordID || -1);
    console.log("Got invoice", default_invoice);

    var user_request = connect.basicGet("user_session");


    function init() {

      $scope.selected = null;

      $q.all([fetchRecords(), user_request])
        .then(function(res) {
    //          expose scope
          console.log('debug', res[0], res[1])
          $scope.invoice_model = res[0];
          console.log("invoice_model", $scope.invoice_model);
          $scope.posting_user = res[1].data.id;
//          select default
          if(default_invoice>0) $scope.select(default_invoice);
        });
    }

    $scope.select = function(id) {
      console.log($scope.invoice_model);
      $scope.selected = $scope.invoice_model.get(id);
      console.log('selected', $scope.selected);
    }

    /*$scope.post = function() {
      console.log("Request for post");
      var INVOICE_TRANSACTION = 2;
//        This could be an arry
      var selected = $scope.selected;
      var request = [];
      *//* support multiple rows selected
       if(selected.length>0) {
       selected.forEach(function(item) {
       if(item.posted==0) {
       request.push(item.id);
       }
       });
       }*//*
//      FIXME 2 is transaction ID for sales - hardcoded probably isn't the best way
      if(selected) request.push({id: selected.id, transaction_type: INVOICE_TRANSACTION, user: $scope.posting_user});

      connect.journal(request)
        .then(function(res) {
          console.log(res);
//            returns a promise
          // TODO error handling
          if(res.status==200) invoicePosted(request);
        });

      console.log("request should be made for", request);
    }

    function invoicePosted(ids) {
      *//*summary
      *   Updates all affected records
      *//*
      console.log('ids', ids);
      ids.forEach(function(invoice_id) {
        console.log($scope.invoice_model);
        console.log(invoice_id);
        console.log($scope.invoice_model.get(invoice_id.id));
        $scope.invoice_model.get(invoice_id.id).posted = true;
      });
    }*/

    function fetchRecords() { 
      var deferred = $q.defer();

      $scope.selected = {};

      connect.req({'tables' : {'sale' : {'columns' : ['id', 'cost', 'currency_id', 'debitor_id', 'discount', 'invoice_date', 'posted']}}})
      .then(function(model) { 
        deferred.resolve(model);
      });

      return deferred.promise;
    }


    init();
  });
angular.module('kpk.controllers').controller('salesController', function($scope, $q, $location, connect, appstate) {
    // TODO
    //  - selecting a debitor should either be done through id or name search (Typeahead select)
    //  - An Invoice should not be able to include the same item (removed from options for future line items)
    //  - Invoice ID should be updated if an invoice is created in the time since invoice creation - see sockets
    console.log("Sales initialised");

    //Default selection for invoice payable
    $scope.invoice = {payable: "false"};
    //TODO perform logic with local variables and expose once complete
    $scope.sale_date = getDate();
    $scope.inventory = [];

    var INVOICE_TYPE = 2;

    var inventory_request = connect.req({'tables' : { 'inventory' : { columns : ['id', 'code', 'text', 'price']}}});

    var max_sales_request = connect.basicGet('/max/id/sale');
    var max_purchase_request = connect.basicGet('/max/id/purchase');

    //FIXME should probably look up debitor table and then patients
    //var debtor_request = connect.req('patient', ['debitor_id', 'first_name', 'last_name', 'location_id']);
    //cache location table to look up debitor details
    //var location_request = connect.req('location', ['id', 'city', 'region', 'country_code']);

    var debtor_query = {
        'e' : [{
          t : 'patient',
          c : ['debitor_id', 'first_name', 'last_name', 'location_id']
        }, {
          t : 'location',
          c : ['id', 'city', 'region', 'country_id']
        }],
        'jc' : [{
          ts : ['patient', 'location'],
          c : ['location_id', 'id']
        }]
    };

    var debtor_request = connect.basicReq(debtor_query);
    var user_request = connect.basicGet("user_session");
     
    function init() { 

//      FIXME requests shouldn't be dependent on order
//      FIXME should verify user ID at the time of submitting invoice, less time to manipulate it I guess
      $q.all([
        inventory_request,
        // sales_request,
        debtor_request,
        user_request,
        max_sales_request,
        max_purchase_request
      ]).then(function(a) { 
        $scope.inventory_model = a[0];
        $scope.debtor_model = a[1];
        $scope.verify = a[2].data.id;
        $scope.max_sales = a[3].data.max;
        $scope.max_purchase = a[4].data.max;


        //$scope.debtor = $scope.debtor_model.data[0]; // select default debtor
        var id = Math.max($scope.max_sales, $scope.max_purchase);
        $scope.invoice_id = createId(id);
      });

    }


    //FIXME Shouldn't need to download every all invoices in this module, only take top few?
    function createId(current) { 
      var default_id = 100000;
      if(!current) return default_id;
      return current + 1;
    }


    function getDate() { 
      //Format the current date according to RFC3339 (for HTML input[type=="date"])
      var now = new Date();
      return now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + ('0' + now.getDate()).slice(-2);
    }

    $scope.formatText = function() {
//      FIXME String functions within digest will take hours
      var debtor_text = '';
      if($scope.debtor) debtor_text = $scope.debtor.last_name + '/' + $scope.debtor.first_name;
      return "PI " + $scope.invoice_id + "/" + debtor_text + "/" + $scope.sale_date;
    }

    $scope.generateInvoice = function() { 
      //Client validation logic goes here - should be complimented with server integrity checks etc.
        
//      FIXME use reduce here
      var t = 0;
      for(var i = 0, l = $scope.inventory.length; i < l; i++) { 
        t += $scope.inventory[i].quantity * $scope.inventory[i].price;
      }
      
      //create invoice record
      var format_invoice = {
        enterprise_id : appstate.get("enterprise").id, //not safe
        id : $scope.invoice_id,
        cost : t,
        currency_id : 1, //ohgd
        debitor_id : $scope.debtor.debitor_id,
        invoice_date: $scope.sale_date,
        seller_id : $scope.verify, //TODO placeholder - this should be derived from appstate (session) or equivelant
        discount: '0', //placeholder
        note : $scope.formatText(),
        posted : '0'
      }

//      Generate Invoice first for foreign key constraints, then create invoice items individually
      connect.basicPut('sale', [format_invoice]).then(function(res) { 
        if(res.status==200) { 
          var promise = generateInvoiceItems();
          promise.then(function(res) { 
            console.log("Invoice successfully generated", res);
            // assuming success - if an error occurs sale should be removed etc.
            journalPost($scope.invoice_id).then(function(res) {
              //everything is good - if there is an error here, sale should be undone (refused from posting journal)
              console.log("posting returned", res);
              $location.path('/sale_records/' + $scope.invoice_id);
            });
          })
        }
      })

      /*
      */
    }

    function journalPost(id) {
      var deferred = $q.defer();
      var request = {id: id, transaction_type: INVOICE_TYPE, user: $scope.verify};
      connect.journal([request]).then(function(res) {
        deferred.resolve(res);
      });
      return deferred.promise;
    }

    function generateInvoiceItems() { 
      var deferred = $q.defer();
      var promise_arr = [];

      //iterate through invoice items and create an entry to sale_item
      $scope.inventory.forEach(function(item) { 
        var format_item = {
          sale_id : $scope.invoice_id,
          inventory_id : item.item.id,
          quantity : item.quantity,
          unit_price : item.price,
          total : item.quantity * item.price
        }
        console.log("Generating sale item for ", item);

        promise_arr.push(connect.basicPut('sale_item', [format_item]));
      });

      $q.all(promise_arr).then(function(res) { deferred.resolve(res)});
      return deferred.promise;
    }

    $scope.invoiceTotal = function() { 
      var total = 0;
      $scope.inventory.forEach(function(item) {
        if(item.quantity && item.price) { 
          //FIXME this could probably be calculated less somewhere else (only when they change)
          total += (item.quantity * item.price);
        }
      });
      return total;
    }

    $scope.updateItem = function(item) { 
      if(!item.quantity) item.quantity = 1;
      item.text = item.item.text;
      item.price = item.item.price;
    }

    $scope.updateInventory = function() { 
      console.log("Update called");
      var new_line = {item: $scope.inventory_model.data[0]}; //select default item
      $scope.inventory.push(new_line);
      $scope.updateItem(new_line); //force updates of fields
      /* 
      Watching a variable that isn't in angular's scope, return the variable in a function
      $scope.$watch(function() { return new_line.item; }, function(nval, oval, scope) { 
        console.log(nval);
      });*/
    };

    $scope.isPayable = function() { 
      if($scope.invoice.payable=="true") return true;
      return false;
    };

    $scope.itemsInInv = function() { 
      if($scope.inventory.length>0) return true;
      return false;
    };

    $scope.formatDebtor = function(debtor) {
      return "[" + debtor.debitor_id + "] " + debtor.first_name + " " + debtor.last_name;
    }

    init();
  });
angular.module('kpk.controllers').controller('userController', function($scope, $q, kpkConnect) {
  //initilaisation var
  
  $scope.selected = {};
  $scope.chkTous = false;
  $scope.showbadpassword=false;
  $scope.showbademail = false;
  $scope.showbadusername = false;

  //population model de table
  getUsers();

  //population model de role
  kpkConnect.fetch("unit", ["id", "name"], 'parent', 0).then(function(data){
    $scope.roles = data;
  });

  //population model d'unite
  kpkConnect.fetch("unit", ["id", "name", "description", "parent"]).then(function(data) { 
    $scope.units = data;
    for(var i=0; i<$scope.units.length; i++){
      $scope.units[i].chkUnitModel = false;
    }    
  });

  //**************** les fonctions *****************
  function getUsers(){
    var request = {}; 
  request.e = [{t : 'user', c : ['id', 'username', 'email', 'password','first', 'last', 'logged_in']}];
  kpkConnect.get('/data/?',request).then(function(data) { 
    $scope.model = data;
  });
  }
  $scope.cancel = function(){
    $scope.selected = {};
    unCheckAll();
  };

  $scope.select = function(index) {
    unCheckAll();
    $scope.selected = $scope.model[index];
    var result = getUserUnits($scope.selected.id);    
    result.then(function(vals){
      for(var i=0; i<vals.length; i++){
        for(var j = 0; j<$scope.units.length; j++){
          if($scope.units[j].id == vals[i].id_unit){
            $scope.units[j].chkUnitModel = true;
          }
        }
      }
    });
  }

  function getUserUnits(idUser){
    var def = $q.defer();
    var request = {}; 
    request.e = [{t : 'permission', c : ['id_unit']}];
    request.c = [{t:'permission', cl:'id_user', v:idUser, z:'='}];
    kpkConnect.get('/data/?', request).then(function (data){      
      def.resolve(data);
    });
    return def.promise;
  }

  $scope.isSelected = function() {    
    return !!($scope.selected);
  }

  $scope.createUser = function() { 
    $scope.selected = {};   
  };

  $scope.changeAll = function(){
    ($scope.chkTous)?checkAll(): unCheckAll();
  };

  $scope.getUnits = function(idRole){
    $scope.tabUnits = [];
    if($scope.units) { 
      for(var i = 0; i < $scope.units.length; i++){
        if($scope.units[i].parent == idRole){
          $scope.tabUnits.push($scope.units[i]);
        }
      }

      return $scope.tabUnits;
    }
    return [];    
  };

  $scope.valider = function (){
    if($scope.selected.email){
      var email = $scope.selected.email;
      var indexAt = email.indexOf('@',0);
      var indexDot = email.lastIndexOf('.',email.length);
      //verification email
      if(indexAt!=-1 && indexDot!=-1 && indexAt<indexDot) {
        $scope.showbademail = false; 
      }else{
        $scope.showbademail = true;
      }
    }else{
      $scope.showbademail = true;
    }
     if($scope.selected.password){
        //verification mot de passe    
        if ($scope.selected.password!= $scope.confirmpw){
          $scope.showbadpassword = true;
        }else{
          $scope.showbadpassword = false;
        }
      }else{
        $scope.showbadpassword = true;
      }

    if($scope.showbademail !== true && $scope.showbadpassword!==true){
      ($scope.selected.id)?updateUser():creer();
    }
  };

  function creer (){
    var result = existe();
    result.then(function(resp){
      if(resp !== true){
        $scope.showbadusername = false;
        kpkConnect.send('user', [{id:'',
                   username: $scope.selected.username,
                   password: $scope.selected.password,
                   first: $scope.selected.first,
                   last: $scope.selected.last,
                   email: $scope.selected.email,
                   logged_in:0}]);

    var request = {}; 
        request.e = [{t : 'user', c : ['id']}];
        request.c = [{t:'user', cl:'username', v:$scope.selected.username, z:'=', l:'AND'}, {t:'user', cl:'password', v:$scope.selected.password, z:'='}];
        kpkConnect.get('data/?',request).then(function(data) {           
          for(var i = 0; i<$scope.units.length; i++){
            if($scope.units[i].chkUnitModel === true && $scope.units[i].parent !==0 && $scope.units[i].id != 0){
              kpkConnect.send('permission', [{id:'', id_unit: $scope.units[i].id, id_user:data[0].id}]);
            }
          }         
    
    });
    refreshUserModel();
      }else{
        $scope.showbadusername = true;
      }

    });
    
  }

    $scope.delete = function(){
      if($scope.selected.id){
        kpkConnect.delete('user', $scope.selected.id);
        $scope.selected = {};
        getUsers();
      }    
  }
    function checkAll(){
      for(var i=0; i<$scope.units.length; i++){
      $scope.units[i].chkUnitModel = true;
    }
    }

    function unCheckAll(){
      for(var i=0; i<$scope.units.length; i++){
      $scope.units[i].chkUnitModel = false;
    }
    }

    function isAllChecked(){
      var rep = true;
      for(var i = 0; i< $scope.units.length; i++){
        if(!$scope.units[i].chkUnitModel){
          rep = false;
          break;
        }
      }
      return rep;
    }

    function refreshUserModel(){
    var request = {}; 
    request.e = [{t : 'user', c : ['id', 'username', 'email', 'password','first', 'last', 'logged_in']}];
    kpkConnect.get('data/?',request).then(function(data) { 
    $scope.model = data;
    $scope.selected={};
    $scope.confirmpw = "";
    $scope.showbadpassword = false;
    $scope.showbademail = false;
    });
    }

    function updateUser(){
      $scope.showbadusername = false;
      kpkConnect.get('data/?', {t:'permission', ids:{id_user:[$scope.selected.id]}, action:'DEL'});
      var sql_update = {t:'user', 
                        data:[{id:$scope.selected.id,
                               username: $scope.selected.username,
                               password: $scope.selected.password,
                               first: $scope.selected.first,
                               last: $scope.selected.last,
                               email:$scope.selected.email}
                             ], 
                        pk:["id"]
                       };
      kpkConnect.update(sql_update);
      for(var i = 0; i<$scope.units.length; i++){
          if($scope.units[i].chkUnitModel === true && $scope.units[i].parent !==0 && $scope.units[i].id != 0){
            kpkConnect.send('permission', [{id:'', id_unit: $scope.units[i].id, id_user:$scope.selected.id}]);
          }
          } 

      

      refreshUserModel();

    }

    function existe(){
      var def = $q.defer();
      var request = {}; 
      request.e = [{t : 'user', c : ['id']}];
      request.c = [{t:'user', cl:'username', v:$scope.selected.username, z:'='}];
      kpkConnect.get('data/?',request).then(function(data) {
       (data.length > 0)?def.resolve(true):def.resolve(false);    
    });
      return def.promise;
    }
    $scope.manageClickUnit = function(id){
      var value = null;
      for(var i=0; i<$scope.units.length; i++){
        if($scope.units[i].id == id){
          value = $scope.units[i].chkUnitModel;
          break;
        }
      }
      if(value === true){
        //tester si tous sont checkes
        if(isAllChecked()){
          $scope.chkTous=true;
        }else{
          $scope.chkTous = false;
        }

      }else{
        $scope.chkTous=false;

      }
    }  
});