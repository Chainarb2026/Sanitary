import { addressRepo, type AddressRecord, type CreateAddressData } from "./repo.js";
import { NotFoundError } from "../../errors/appError.js";

/**
 * Service encapsulating customer address management.
 */
export class AddressService {
  /**
   * Registers a customer pickup address with GeoJSON coordinates.
   */
  public async create(
    userId: string,
    data: Omit<CreateAddressData, "userId">,
  ): Promise<AddressRecord> {
    if (data.isDefault) {
      await addressRepo.unsetDefaults(userId);
    }

    return addressRepo.create({
      userId,
      ...data,
    });
  }

  /**
   * Retrieves all addresses for a customer.
   */
  public async getByUserId(userId: string): Promise<AddressRecord[]> {
    return addressRepo.findByUserId(userId);
  }

  /**
   * Retrieves single address by ID verifying customer ownership.
   */
  public async getById(id: string, userId: string): Promise<AddressRecord> {
    const address = await addressRepo.findById(id);
    if (!address || address.userId !== userId) {
      throw new NotFoundError(`Address with ID '${id}' not found`);
    }
    return address;
  }

  /**
   * Deletes an address verifying customer ownership.
   */
  public async delete(id: string, userId: string): Promise<void> {
    const deleted = await addressRepo.deleteById(id, userId);
    if (!deleted) {
      throw new NotFoundError(`Address with ID '${id}' not found`);
    }
  }
}

export const addressService = new AddressService();
