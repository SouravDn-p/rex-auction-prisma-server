import { AuctionStatus, DeliveryStatus, PaymentStatus } from "@prisma/client";

export interface CreateAuctionDto {
  title: string;
  description: string;
  itemCondition: string;
  itemYear: number;
  itemReference: string;
  itemValuation: number;
  history: string;
  images: string[];
  category?: string;
  startingPrice: number;
  startTime: string; // ISO date
  endTime: string;   // ISO date
  notes?: string;
}

export interface UpdateAuctionDto {
  title?: string;
  description?: string;
  itemCondition?: string;
  itemYear?: number;
  itemReference?: string;
  itemValuation?: number;
  history?: string;
  images?: string[];
  category?: string;
  startingPrice?: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export interface AdminReviewAuctionDto {
  status: "upcoming" | "cancelled";
  notes?: string;
}

export interface ListAuctionsQuery {
  page?: number;
  limit?: number;
  status?: AuctionStatus;
  category?: string;
  sellerId?: number;
  search?: string;
}