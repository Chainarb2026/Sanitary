import { userRepo, type UserRecord, type CreateUserData } from "./repo.js";
import type { UserRole } from "@sanitary/shared";

/**
 * Service encapsulating User domain operations.
 */
export class UserService {
  /**
   * Retrieves a user by phone or registers a new user if not found.
   * Big-O: O(log N) lookup and conditional insertion.
   */
  public async findOrCreateByPhone(phone: string, defaultRole?: UserRole): Promise<UserRecord> {
    const existing = await userRepo.findByPhone(phone);
    if (existing) {
      return existing;
    }

    return userRepo.create({
      phone,
      role: defaultRole ?? "customer",
    });
  }

  /**
   * Finds a user by ID.
   * Big-O: O(log N) primary key lookup.
   */
  public async findById(id: string): Promise<UserRecord | null> {
    return userRepo.findById(id);
  }

  /**
   * Finds a user by phone number.
   * Big-O: O(log N) indexed search.
   */
  public async findByPhone(phone: string): Promise<UserRecord | null> {
    return userRepo.findByPhone(phone);
  }

  /**
   * Creates a user explicitly.
   */
  public async create(data: CreateUserData): Promise<UserRecord> {
    return userRepo.create(data);
  }
}

export const userService = new UserService();
