import './env';
import './instrument'; // before anything else, so errors everywhere are caught
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true }); // rawBody: Razorpay webhook signature
  const webOrigin = process.env.WEB_ORIGIN!;

  app.useBodyParser('json', { limit: '3mb' }); // challenge sheets; everything else is tiny
  app.set('trust proxy', 1); // behind Render/Railway's proxy: real client IP for rate limits
  app.enableCors({ origin: webOrigin, credentials: true });
  // CSRF guard: browsers attach our cookie on requests from any *.arithi.in page,
  // so only our own web app may make changes.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && origin !== webOrigin && !SAFE_METHODS.includes(req.method)) {
      res.status(403).json({ message: 'Forbidden origin' });
      return;
    }
    next();
  });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
