import { Module } from '@nestjs/common';
import { ClinicalRecordsController } from './clinical-records.controller.js';
@Module({ controllers: [ClinicalRecordsController] })
export class ClinicalRecordsModule {}
