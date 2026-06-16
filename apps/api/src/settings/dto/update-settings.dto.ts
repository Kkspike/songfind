import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() prowlarrUrl?: string;
  @IsOptional() @IsString() prowlarrApiKey?: string;
  @IsOptional() @IsString() lidarrUrl?: string;
  @IsOptional() @IsString() lidarrApiKey?: string;
  @IsOptional() @IsString() azuracastUrl?: string;
  @IsOptional() @IsString() azuracastApiKey?: string;
  @IsOptional() @IsString() azuracastStationIds?: string;
  @IsOptional() @IsString() nasMountPath?: string;
  @IsOptional() @IsString() spotifyClientId?: string;
  @IsOptional() @IsString() spotifyClientSecret?: string;
  @IsOptional() @IsString() spotifyRedirectUri?: string;
  @IsOptional() @IsInt() @Min(1) fallbackTimeoutMins?: number;
}
