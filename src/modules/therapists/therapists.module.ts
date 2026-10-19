import { Module } from '@nestjs/common';
import { TherapistsController } from './therapists.controller.js';

@Module({ controllers: [TherapistsController] })
export class TherapistsModule {}
