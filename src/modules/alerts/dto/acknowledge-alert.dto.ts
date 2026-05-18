import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class AcknowledgeAlertDto {
  @ApiProperty({
    example: 1710000050,
  })
  @IsNumber()
  @IsInt()
  @Min(1)
  acknowledgedAt: number;

  @ApiProperty({
    example: "Prathamesh",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  acknowledgedBy?: string;
}
