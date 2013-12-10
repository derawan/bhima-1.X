(function(angular) {
  'use strict';

  //FIXME: Format code correctly in seperate files/modules etc.
  var kpk = angular.module('kpk', ['kpk.controllers', 'kpk.services', 'kpk.directives', 'kpk.filters', 'angularTreeview', 'ui.bootstrap', 'ui.bootstrap.tabs', 'pascalprecht.translate']);
  
  function kpkconfig($routeProvider) { 
    //TODO: Dynamic routes loaded from unit database?
    $routeProvider.
    when('/budgeting', {
      controller: 'budgetController',
      templateUrl: 'partials/budget/budget.html'
    }).
    when('/permission', { 
      controller: 'userController',
      templateUrl: 'partials/user_permission/permissions.html'
    }).
    when('/enterprise', { 
      controller: 'enterpriseController',
      templateUrl: 'partials/enterprise/enterprise.html'
    }).
    when('/posting_journal', {
      controller: 'journalController',
      templateUrl:'partials/journal/journal.html'
    }).
    when('/fiscal', {
      controller: 'fiscalController',
      templateUrl: 'partials/fiscal/fiscal.html'
    }).
    when('/patient', { 
      controller: 'patientRegController',
      templateUrl: 'partials/patient_registration/patient.html'
    }).
    when('/accounts', {
      controller: 'accountController',
      templateUrl: '/partials/accounts/accounts.html'
    }).
    when('/inventory', {
      controller: 'inventoryController',
      templateUrl: '/partials/inventory/inventory.html'
    }).
    when('/patient_records/:patientID', { 
      controller: 'patientRecordsController', 
      templateUrl: '/partials/records/patient_records/patient_records.html'
    }).
    when('/sales', { 
      controller: 'salesController',
      templateUrl: '/partials/sales/sales.html'
    }).
    when('/sale_records/:recordID', { 
      controller: 'salesRecordsController',
      templateUrl: '/partials/records/sales_records/sales_records.html'
    }).
    when('/inventory/register', {
      controller: 'inventoryRegisterController',
      templateUrl: '/partials/inventory/register/register.html'
    }).
    when('/cash', {
      controller: 'cashController',
      templateUrl: '/partials/cash/cash.html'
    }).when('/creditors', {
      controller: 'creditorsController',
      templateUrl: '/partials/creditor/creditor.html'
    }).
    when('/creditors/creditor_group', {
      controller: 'creditorGroupCtrl',
      templateUrl: 'partials/creditor/group/creditor_group.html'
    }).
    when('/inventory/purchase', {
      controller: 'purchaseOrderController',
      templateUrl: 'partials/purchase_order/purchase.html'
    }).
    when('/purchase_records/:purchaseID', {
      controller: 'purchaseRecordsController',
      templateUrl: 'partials/records/purchase_order_records/purchase_records.html'
    }).
    when('/inventory/price_list', {
      controller: 'priceListController',
      templateUrl: 'partials/pricelist/pricelist.html'
    }).
    when('/exchange_rate', {
      controller : 'exchangeRateController',
      templateUrl: 'partials/exchange_rate/exchange_rate.html'
    }).
    when('/create_account', {
      controller: 'createAccountController',
      templateUrl: 'partials/accounts/create_account/create.html'
    }).
    when('/reports/finance', { 
      controller: 'reportFinanceController',
      templateUrl: 'partials/reports/finance/finance_report.html'
    }).
    when('/reports/transaction_report', { 
      controller: 'reportTransactionController',
      templateUrl: 'partials/reports/transaction_report/transaction_report.html'
    });
  }  

  function translateConfig($translateProvider) { 
    //TODO Configurations loaded from files on the server (pointed to by database?)
    //TODO Review how translations should be split - functionality, unit, etc.
    //TODO Review i18n and determine if this it the right solution
    $translateProvider.translations('en', {
      //Accounting terminology
      POSTING_JOURNAL: "posting journal",
      TRANSACTION: "transaction",
      ACCOUNT: "account",
      TRIAL_BALANCE: "trial balance",
      GENERAL_LEDGER: "general ledger",
      DEBIT: "debit",
      CREDIT: "credit",
      FISCAL_YEAR: "fiscal year",

      //Application functions
      CONFIGURE: "configure",
      PRINT: "print",
      CREATE: "create",

      //Generic database
      ID: "id",
      DATE: "date",
      DESCRIPTION: "description",

      // Actions
      SAVE: 'save',
      DELETE : 'delete',
      CANCEL : 'cancel',

      //Titles
      MANAGEMENT: "management",

      //Journal database
      DOC_NO: "doc no.",
      DEB_CRED_ACCOUNT: "debitor/creditor account",
      DEB_CRED_TYPE: "debitor/creditor type",
      INV_PO_NO: "inv/PO no.",

      // Users and Permissions
      UP_TITLE : 'users & permissions management', // FIXME: namespaces
      FIRST_NAME : 'first name',
      LAST_NAME : 'last name',
      EMAIL : 'email',
      USER_NAME : 'username',
      PASSWORD : 'password',
      CONFIRM : 'confirm',
      ALL : 'all',
      REGISTERED_USERS : 'registered users',
      CHECK : 'check',
      UNITS : 'units',
      USER : 'user',
      PERMISSION: 'permission',
      UP_DIALOGUE : 'check units which user ', // This token is non-normative
      UP_DIALOGUE_2 : 'will access',

    });

    $translateProvider.translations('fr', {
      //Accounting terminology
      POSTING_JOURNAL: "journal de saisie",
      TRANSACTION: "opération",
      ACCOUNT: "compte",
      TRIAL_BALANCE: "balance de vérification",
      GENERAL_LEDGER: "grand livre général",
      DEBIT: "débit",
      CREDIT: "crédit",

      // Application functions
      CONFIGURE: "configurer",
      PRINT: "imprimer",
      CREATE: "crée",

      // Generic database
      ID: "id",
      DATE: "date",
      DESCRIPTION: "description",

      // Actions
      SAVE: 'enregistre',
      DELETE : 'souplimer',
      CANCEL : 'retourner',

      //Titles
      MANAGEMENT: "gestion",

      //Journal database
      DOC_NO: "doc no.",
      DEB_CRED_ACCOUNT: "debitor/creditor account",
      DEB_CRED_TYPE: "debitor/creditor type",
      INV_PO_NO: "inv/PO no.",

      // Users and Permissions
      UP_TITLE : 'gestion de utilisateurs et permissions',
      FIRST_NAME : 'prenom',
      LAST_NAME : 'postnom',
      EMAIL : 'email',
      USER_NAME : 'nom de utilisateur',
      PASSWORD : 'mots de pass',
      CONFIRM : 'confirmer',
      ALL : 'tous',
      REGISTERED_USERS : 'utilisateurs',
      CHECK : 'crocher',
      UNITS : 'modules',
      USER : 'utilisateur',
      PERMISSION: 'permission',
      UP_DIALOGUE : 'crocher les modules utilisateur ', // This token is non-normative
      UP_DIALOGUE_2 : 'peut acceder',

    });

    $translateProvider.preferredLanguage('en');
  }

  kpk.config(kpkconfig);
  kpk.config(translateConfig);
})(angular);
