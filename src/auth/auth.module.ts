import { Module } from '@nestjs/common';

import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { DrizzleModule } from 'src/providers/drizzle.provider';

@Module({
  imports: [DrizzleModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
