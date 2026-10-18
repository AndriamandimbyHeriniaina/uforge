import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One text file of the workspace. */
export class WorkspaceFileDto {
  @IsString()
  @MaxLength(300)
  path!: string;

  @IsString()
  @MaxLength(2_000_000)
  content!: string;
}

/** A binary asset, listed but never sent. */
export class AssetRefDto {
  @IsString()
  @MaxLength(300)
  path!: string;

  @IsString()
  @MaxLength(100)
  mime!: string;

  @IsInt()
  @Min(0)
  size!: number;
}

/** A file attached to this message by the admin. */
export class AttachmentDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(['image', 'text'])
  kind!: 'image' | 'text';

  @IsString()
  @MaxLength(100)
  mime!: string;

  @IsOptional()
  @IsString()
  dataBase64?: string;

  @IsOptional()
  @IsString()
  content?: string;

  /** Set when the image was also added to the project. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  assetPath?: string;
}

/** An error reported by the preview iframe or by the compiler. */
export class RuntimeErrorDto {
  @IsIn(['runtime', 'build'])
  source!: 'runtime' | 'build';

  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  file?: string;

  @IsOptional()
  @IsInt()
  line?: number;
}

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(20000)
  text!: string;
}

/**
 * One conversation turn. The workspace travels with every request: the gateway
 * keeps nothing between turns.
 *
 * @example
 * { message: 'Ajoute un panier', files: [{ path: 'index.html', content: '…' }] }
 */
export class GenerateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  appId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceFileDto)
  files?: WorkspaceFileDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AssetRefDto)
  assets?: AssetRefDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RuntimeErrorDto)
  errors?: RuntimeErrorDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  conversation?: ChatTurnDto[];
}
