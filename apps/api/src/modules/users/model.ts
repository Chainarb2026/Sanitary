import mongoose, { Schema, type Document, type Model } from "mongoose";
import { USER_ROLES, type UserRole } from "@sanitary/shared";

export interface IUser {
  phone: string;
  role: UserRole;
  name?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = IUser & Document;

const userSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "customer",
      required: true,
    },
    name: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * INDEX EXPLANATION:
 * Unique index on `phone` ensures no duplicate user accounts exist for the same
 * Indian mobile number, preventing identity fragmentation and race conditions.
 * O(log N) lookup time for authentication queries.
 */
userSchema.index({ phone: 1 }, { unique: true });

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema, "users");
