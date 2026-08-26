import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAppDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class GenerateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  prompt!: string;

  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  draftId?: string;
}
