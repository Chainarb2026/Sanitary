import { UserModel, type IUser } from "./model.js";
import type { UserRole } from "@sanitary/shared";

export interface UserRecord extends IUser {
  _id: string;
}

export interface CreateUserData {
  phone: string;
  role?: UserRole;
  name?: string;
}

/**
 * Data Access Repository for Users collection.
 */
export class UserRepo {
  /**
   * Finds a user by phone number using lean projection.
   * Big-O: O(log N) lookup via unique phone index.
   */
  public async findByPhone(phone: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ phone }).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    };
  }

  /**
   * Finds a user by internal MongoDB ObjectId.
   * Big-O: O(log N) lookup via _id primary index.
   */
  public async findById(id: string): Promise<UserRecord | null> {
    const doc = await UserModel.findById(id).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    };
  }

  /**
   * Creates a new user document.
   * Big-O: O(log N) insertion time.
   */
  public async create(data: CreateUserData): Promise<UserRecord> {
    const doc = await UserModel.create({
      phone: data.phone,
      role: data.role ?? "customer",
      name: data.name,
      isActive: true,
    });
    return {
      phone: doc.phone,
      role: doc.role,
      name: doc.name,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      _id: doc._id.toString(),
    };
  }

  /**
   * Updates an existing user by ID.
   * Big-O: O(log N) index seek and update.
   */
  public async updateById(
    id: string,
    updates: Partial<Pick<IUser, "name" | "role" | "isActive">>,
  ): Promise<UserRecord | null> {
    const doc = await UserModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .lean()
      .exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    };
  }
}

export const userRepo = new UserRepo();
