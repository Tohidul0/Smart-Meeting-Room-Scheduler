import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Smart Meeting Room Scheduler API')
    .setDescription('API documentation for intelligent meeting room allocation system')
    .setVersion('1.0')
    .addTag('Meetings')
    .addTag('Scheduler')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('🚀 Application running at http://localhost:3000');
  console.log('📘 Swagger docs at http://localhost:3000/api');
}
bootstrap();
