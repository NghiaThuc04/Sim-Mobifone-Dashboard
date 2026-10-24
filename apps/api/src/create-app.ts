import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readConfig, type ApiConfig } from './config';
import { json } from 'express';
import { HttpErrorFilter } from './http-error.filter';
import type { INestApplication } from '@nestjs/common';
import { SIM_IMPORT_LIMITS } from '@sim-dashboard/shared';
import type { Request,Response,NextFunction } from 'express';

export function configureHttp(app: INestApplication, config: ApiConfig) {
  const standardJson=json({limit:'8kb',strict:true});const uploadJson=json({limit:SIM_IMPORT_LIMITS.jsonBytes,strict:true});const confirmJson=json({limit:SIM_IMPORT_LIMITS.confirmBytes,strict:true});
  app.use((request:Request,response:Response,next:NextFunction)=>{
    const parser=request.method==='POST'&&request.path==='/api/v1/admin/sim-imports/preview'?uploadJson:
      request.method==='POST'&&/^\/api\/v1\/admin\/sim-imports\/[0-9a-f-]{36}\/confirm$/i.test(request.path)?confirmJson:standardJson;
    parser(request,response,next);
  });
  app.enableCors({ origin: config.FRONTEND_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT','DELETE'], allowedHeaders: ['Content-Type'] });
  app.useGlobalFilters(new HttpErrorFilter());
  app.setGlobalPrefix('api/v1');
}

export async function createApp(logging = true, config: ApiConfig = readConfig()) {
  const app = await NestFactory.create(AppModule.register(config), { logger: logging ? undefined : false, bodyParser: false });
  configureHttp(app, config);
  return app;
}
