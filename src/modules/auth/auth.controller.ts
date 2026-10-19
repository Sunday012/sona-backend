import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../../common/security/request-user.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('register') register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }
  @Public() @HttpCode(200) @Post('login') login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
  @Public() @HttpCode(200) @Post('verify-email') verifyEmail(@Body() input: VerifyEmailDto) {
    return this.auth.verifyEmail(input.token);
  }
  @Public() @HttpCode(202) @Post('resend-verification') resend(@Body() input: ResendVerificationDto) {
    return this.auth.resendVerification(input.email);
  }
  @Public() @HttpCode(200) @Post('refresh') refresh(@Body() input: RefreshTokenDto) {
    return this.auth.refresh(input.refreshToken);
  }
  @Public() @HttpCode(202) @Post('forgot-password') forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.auth.forgotPassword(input.email);
  }
  @Public() @HttpCode(200) @Post('reset-password') resetPassword(@Body() input: ResetPasswordDto) {
    return this.auth.resetPassword(input.token, input.newPassword);
  }
  @HttpCode(204) @Post('logout') logout(@Body() input: RefreshTokenDto) {
    return this.auth.logout(input.refreshToken);
  }
  @Get('me')
  @ApiBearerAuth()
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user!.sub);
  }
}
