angular.module('kpk.controllers')
.controller('primaryCash', [
  '$scope',
  '$location',
  'validate',
  function ($scope, $location, validate) { 
    var dependencies = {}, session = $scope.session = {};
    var configuration = $scope.configuration = {};

    dependencies.cashBox = { 
      query : { 
        tables : { 
          cash_box : { columns : ['id', 'text', 'project_id', 'is_auxillary'] }
        },
        where : ['cash_box.is_auxillary=0']
      }
    };

    configuration.income = [
      {
        key : 'PURCHASE',
        link : '/primary_cash/income/purchase/'
      },
      {
        key : 'GENERIC_INCOME',
        link : '/primary_cash/income/generic/'
      }
    ];

    configuration.expense = [
      {
        key : 'GENERIC_EXPENSE',
        link : '/primary_cash/expense/generic/'
      }
    ];
     
    validate.process(dependencies).then(initialise);

    function initialise(model) { 
      angular.extend($scope, model);
     
      // Select default cashbox
      session.cashbox = model.cashBox.data[0].id;
    }

    function loadPath(path) { 

      //TODO validate both correct path and cashbox
      $location.path(path + session.cashbox);
    }

    $scope.loadPath = loadPath;
  }
]);