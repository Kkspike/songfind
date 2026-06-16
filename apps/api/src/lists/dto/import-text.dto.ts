import { IsString, MinLength } from 'class-validator';

export class ImportTextDto {
  @IsString()
  @MinLength(1)
  text: string;
}
