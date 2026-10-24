import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { FcmTokenService } from './fcm-token.service';

@Global()
@Module({
  providers: [FirebaseService, FcmTokenService],
  exports: [FirebaseService, FcmTokenService],
})
export class FirebaseModule {}
