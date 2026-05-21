import { SellerRequestStatus } from "@prisma/client";

export interface UpdateUserDto {
  name?: string;
  photo?: string;
  cover?: string;
  location?: string;
}

export interface SubmitSellerRequestDto {
  businessName: string;
  contactPhone: string;
  address: string;
  taxId: string;
  additionalNotes?: string;
}

export interface ReviewSellerRequestDto {
  status: SellerRequestStatus;
}

export interface UpdateUserStatusDto {
  isActive: boolean;
}
