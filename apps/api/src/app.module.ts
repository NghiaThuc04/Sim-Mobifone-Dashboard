import { DynamicModule, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { APP_CONFIG, type ApiConfig } from './config';
import { DatabaseService } from './database/database.service';
import { DbHealthController } from './database/db-health.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthRepository } from './auth/auth.repository';
import { LoginLimiter } from './auth/login-limiter';
import { SessionService } from './auth/session.service';
import { APP_GUARD } from '@nestjs/core';
import { SessionGuard, PermissionGuard } from './authorization/access.guards';
import { AuthorizationService } from './authorization/authorization.service';
import { AuditService } from './audit/audit.service';
import { EmployeesController } from './employees/employees.controller';
import { EmployeesService } from './employees/employees.service';
import { EmployeesRepository } from './employees/employees.repository';
import { MutationGuard } from './authorization/mutation.guard';
import { CommissionsController } from './commissions/commissions.controller';
import { CommissionsService } from './commissions/commissions.service';
import { CommissionsRepository } from './commissions/commissions.repository';
import { SalariesController } from './salaries/salaries.controller';
import { SalariesService } from './salaries/salaries.service';
import { SalariesRepository } from './salaries/salaries.repository';
import { LeavesController } from './leaves/leaves.controller';
import { LeavesService } from './leaves/leaves.service';
import { LeavesRepository } from './leaves/leaves.repository';
import { MyLeavesController } from './leaves/my-leaves.controller';
import { CatalogsController } from './catalogs/catalogs.controller';
import { CatalogsService } from './catalogs/catalogs.service';
import { CatalogsRepository } from './catalogs/catalogs.repository';
import { SimPricingService } from './inventory/sim-pricing.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { InventoryRepository } from './inventory/inventory.repository';
import { SimWriteRepository } from './inventory/sim-write.repository';
import { SimImportController } from './imports/import.controller';
import { SimImportService } from './imports/import.service';
import { SimImportRepository } from './imports/import.repository';
import { PriceAlertsController, PriceAlertsService, PriceAlertsRepository } from './inventory/price-alerts.controller';
import { CheckSimController } from './inventory/check-sim.controller';
import { CheckSimService } from './inventory/check-sim.service';
import { CheckSimRepository } from './inventory/check-sim.repository';
import { StaffSimSubmissionsController } from './inventory/staff-sim-submissions.controller';
import { ReservationsService } from './orders/reservations.service';
import { OrderCreateController } from './orders/order-create.controller';
import { OrderCreateService } from './orders/order-create.service';
import { OrderCreateRepository } from './orders/order-create.repository';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { OrderWorkflowRepository } from './orders/order-workflow.repository';
import { OrdersRepository } from './orders/orders.repository';

@Module({})
export class AppModule {
  static register(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, DbHealthController, AuthController, EmployeesController, CommissionsController, SalariesController, LeavesController, MyLeavesController, CatalogsController, InventoryController,SimImportController, PriceAlertsController, CheckSimController, StaffSimSubmissionsController, OrderCreateController, OrdersController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DatabaseService, useFactory: () => new DatabaseService(config) },
        AuthService, AuthRepository, LoginLimiter, SessionService,
        AuthorizationService, AuditService, MutationGuard,
        EmployeesService, EmployeesRepository,
        CommissionsService, CommissionsRepository,
        SalariesService, SalariesRepository,
        LeavesService, LeavesRepository,
        CatalogsService, CatalogsRepository,
        SimPricingService,
        InventoryService, InventoryRepository,
        SimWriteRepository,
        SimImportService,SimImportRepository,
        PriceAlertsService, PriceAlertsRepository,
        CheckSimService, CheckSimRepository,
        ReservationsService,
        OrderCreateService, OrderCreateRepository,
        OrdersService, OrdersRepository, OrderWorkflowRepository,
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    };
  }
}
