import mongoose, { type FilterQuery } from "mongoose";
import { BookingModel, type IBooking } from "./model.js";
import type {
  BookingStatus,
  BookingRecord,
  BookingItem,
  BookingAddressSnapshot,
  BookingSlot,
  BookingQuoteBreakdown,
  BookingStatusHistoryEntry,
  PaginatedResponse,
} from "@sanitary/shared";

export interface CreateBookingRepoData {
  customerId: string;
  partnerId?: string;
  items: BookingItem[];
  address: BookingAddressSnapshot;
  slot: BookingSlot;
  quote: BookingQuoteBreakdown;
  status: BookingStatus;
  statusHistory: BookingStatusHistoryEntry[];
  pickupOtpHashed: string;
  idempotencyKey?: string;
  customerNotes?: string;
}

export interface DecodedCursor {
  createdAt: Date;
  id: string;
}

/**
 * Encodes keyset cursor into opaque base64 string.
 * Big-O: O(1) time, O(1) space.
 */
export function encodeCursor(createdAt: Date, id: string): string {
  const payload = JSON.stringify({ createdAt: createdAt.toISOString(), id });
  return Buffer.from(payload, "utf8").toString("base64url");
}

/**
 * Decodes opaque base64 keyset cursor.
 * Big-O: O(1) time, O(1) space.
 */
export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.createdAt || !parsed.id) return null;
    return {
      createdAt: new Date(parsed.createdAt),
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

export interface IBookingRecordLike {
  _id: mongoose.Types.ObjectId | string;
  customerId: mongoose.Types.ObjectId | string;
  partnerId?: mongoose.Types.ObjectId | string;
  items: Array<{
    wasteTypeId: mongoose.Types.ObjectId | string;
    name: string;
    category: string;
    quantity: number;
    estimatedWeightKg?: number;
    actualWeightKg?: number;
    pricePaise: number;
  }>;
  address: {
    addressId?: mongoose.Types.ObjectId | string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    location: {
      type: "Point";
      coordinates: [number, number];
    };
    buildingId?: mongoose.Types.ObjectId | string;
  };
  slot: BookingSlot;
  quote: BookingQuoteBreakdown;
  status: BookingStatus;
  statusHistory: Array<{
    from: BookingStatus;
    to: BookingStatus;
    timestamp: Date | string;
    reason?: string;
    updatedBy: string;
  }>;
  pickupOtpHashed: string;
  idempotencyKey?: string;
  cancelReason?: string;
  cancelledBy?: "customer" | "partner" | "admin" | "system";
  cancellationFeePaise?: number;
  customerNotes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function mapDocToRecord(doc: IBookingRecordLike): BookingRecord {
  return {
    _id: doc._id.toString(),
    customerId: doc.customerId.toString(),
    partnerId: doc.partnerId?.toString(),
    items: doc.items.map((it) => ({
      wasteTypeId: it.wasteTypeId.toString(),
      name: it.name,
      category: it.category,
      quantity: it.quantity,
      estimatedWeightKg: it.estimatedWeightKg,
      actualWeightKg: it.actualWeightKg,
      pricePaise: it.pricePaise,
    })),
    address: {
      addressId: doc.address.addressId?.toString(),
      addressLine1: doc.address.addressLine1,
      addressLine2: doc.address.addressLine2,
      city: doc.address.city,
      state: doc.address.state,
      pincode: doc.address.pincode,
      location: doc.address.location,
      buildingId: doc.address.buildingId?.toString(),
    },
    slot: doc.slot,
    quote: doc.quote,
    status: doc.status,
    statusHistory: doc.statusHistory.map((sh) => ({
      from: sh.from,
      to: sh.to,
      timestamp: new Date(sh.timestamp).toISOString(),
      reason: sh.reason,
      updatedBy: sh.updatedBy,
    })),
    pickupOtpHashed: doc.pickupOtpHashed,
    idempotencyKey: doc.idempotencyKey,
    cancelReason: doc.cancelReason,
    cancelledBy: doc.cancelledBy,
    cancellationFeePaise: doc.cancellationFeePaise,
    customerNotes: doc.customerNotes,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

/**
 * Repository layer for Bookings collection with atomic operations and keyset pagination.
 */
export class BookingRepo {
  public async create(data: CreateBookingRepoData): Promise<BookingRecord> {
    const doc = await BookingModel.create({
      customerId: mongoose.Types.ObjectId.isValid(data.customerId)
        ? new mongoose.Types.ObjectId(data.customerId)
        : new mongoose.Types.ObjectId(),
      partnerId:
        data.partnerId && mongoose.Types.ObjectId.isValid(data.partnerId)
          ? new mongoose.Types.ObjectId(data.partnerId)
          : undefined,
      items: data.items.map((it) => ({
        ...it,
        wasteTypeId: mongoose.Types.ObjectId.isValid(it.wasteTypeId)
          ? new mongoose.Types.ObjectId(it.wasteTypeId)
          : new mongoose.Types.ObjectId(),
      })),
      address: {
        ...data.address,
        addressId:
          data.address.addressId && mongoose.Types.ObjectId.isValid(data.address.addressId)
            ? new mongoose.Types.ObjectId(data.address.addressId)
            : undefined,
        buildingId:
          data.address.buildingId && mongoose.Types.ObjectId.isValid(data.address.buildingId)
            ? new mongoose.Types.ObjectId(data.address.buildingId)
            : undefined,
      },
      slot: data.slot,
      quote: data.quote,
      status: data.status,
      statusHistory: data.statusHistory.map((sh) => ({
        ...sh,
        timestamp: new Date(sh.timestamp),
      })),
      pickupOtpHashed: data.pickupOtpHashed,
      idempotencyKey: data.idempotencyKey,
      customerNotes: data.customerNotes,
    });

    return mapDocToRecord(doc);
  }

  public async findById(id: string): Promise<BookingRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await BookingModel.findById(id).lean().exec();
    if (!doc) return null;
    return mapDocToRecord(doc);
  }

  public async findByIdempotencyKey(
    customerId: string,
    idempotencyKey: string,
  ): Promise<BookingRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(customerId)) return null;
    const doc = await BookingModel.findOne({
      customerId: new mongoose.Types.ObjectId(customerId),
      idempotencyKey,
    })
      .lean()
      .exec();

    if (!doc) return null;
    return mapDocToRecord(doc);
  }

  /**
   * Keyset paginated retrieval for customer bookings.
   * Big-O: O(limit) time and O(limit) space using compound index { customerId: 1, createdAt: -1 }.
   */
  public async findCustomerBookings(
    customerId: string,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<BookingRecord>> {
    const filter: FilterQuery<IBooking> = {
      customerId: new mongoose.Types.ObjectId(customerId),
    };

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        filter.$or = [
          { createdAt: { $lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, _id: { $lt: new mongoose.Types.ObjectId(decoded.id) } },
        ];
      }
    }

    const docs = await BookingModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem._id.toString()) : null;

    return {
      items: items.map(mapDocToRecord),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Keyset paginated retrieval for partner bookings.
   * Big-O: O(limit) time and O(limit) space using index { partnerId: 1, status: 1, createdAt: -1 }.
   */
  public async findPartnerBookings(
    partnerId: string,
    status?: BookingStatus,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<BookingRecord>> {
    const filter: FilterQuery<IBooking> = {
      partnerId: new mongoose.Types.ObjectId(partnerId),
    };

    if (status) {
      filter.status = status;
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        filter.$or = [
          { createdAt: { $lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, _id: { $lt: new mongoose.Types.ObjectId(decoded.id) } },
        ];
      }
    }

    const docs = await BookingModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem._id.toString()) : null;

    return {
      items: items.map(mapDocToRecord),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Keyset paginated retrieval for admin bookings.
   * Big-O: O(limit) time and O(limit) space using index { createdAt: -1, _id: -1 }.
   */
  public async findAdminBookings(
    filters: {
      status?: BookingStatus;
      customerId?: string;
      partnerId?: string;
    },
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<BookingRecord>> {
    const filter: FilterQuery<IBooking> = {};

    if (filters.status) {
      filter.status = filters.status;
    }
    if (filters.customerId && mongoose.Types.ObjectId.isValid(filters.customerId)) {
      filter.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }
    if (filters.partnerId && mongoose.Types.ObjectId.isValid(filters.partnerId)) {
      filter.partnerId = new mongoose.Types.ObjectId(filters.partnerId);
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        filter.$or = [
          { createdAt: { $lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, _id: { $lt: new mongoose.Types.ObjectId(decoded.id) } },
        ];
      }
    }

    const docs = await BookingModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const lastAdminItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastAdminItem
        ? encodeCursor(lastAdminItem.createdAt, lastAdminItem._id.toString())
        : null;

    return {
      items: items.map(mapDocToRecord),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Atomic conditional update enforcing status precondition to prevent race conditions.
   * Big-O: O(1) indexed write.
   */
  public async atomicStatusUpdate(params: {
    bookingId: string;
    fromStatus: BookingStatus;
    toStatus: BookingStatus;
    historyEntry: BookingStatusHistoryEntry;
    cancelReason?: string;
    cancelledBy?: "customer" | "partner" | "admin" | "system";
    cancellationFeePaise?: number;
  }): Promise<BookingRecord | null> {
    const updateObj: Record<string, unknown> = {
      $set: {
        status: params.toStatus,
        ...(params.cancelReason ? { cancelReason: params.cancelReason } : {}),
        ...(params.cancelledBy ? { cancelledBy: params.cancelledBy } : {}),
        ...(params.cancellationFeePaise !== undefined
          ? { cancellationFeePaise: params.cancellationFeePaise }
          : {}),
      },
      $push: {
        statusHistory: {
          from: params.historyEntry.from,
          to: params.historyEntry.to,
          timestamp: new Date(params.historyEntry.timestamp),
          reason: params.historyEntry.reason,
          updatedBy: params.historyEntry.updatedBy,
        },
      },
    };

    const doc = await BookingModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(params.bookingId),
        status: params.fromStatus,
      },
      updateObj,
      { new: true },
    )
      .lean()
      .exec();

    if (!doc) return null;
    return mapDocToRecord(doc);
  }
}

export const bookingRepo = new BookingRepo();
