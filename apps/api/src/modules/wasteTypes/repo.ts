import { WasteTypeModel, type IWasteType } from "./model.js";
import type { DefaultWasteTypeSeed } from "./seedData.js";

export interface WasteTypeRecord extends IWasteType {
  _id: string;
}

export interface CreateWasteTypeInput {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  ratePerKg: number;
  commissionRate: number;
  unit: string;
  isActive?: boolean;
}

/**
 * Data Access Repository for WasteTypes collection.
 */
export class WasteTypeRepo {
  /**
   * Retrieves active waste types with lean projection.
   * Big-O: O(log N + k) where k is the active catalog size.
   */
  public async findActive(): Promise<WasteTypeRecord[]> {
    const docs = await WasteTypeModel.find({ isActive: true }).sort({ createdAt: 1 }).lean().exec();

    return docs.map((doc) => ({
      ...doc,
      _id: doc._id.toString(),
    }));
  }

  /**
   * Retrieves all waste types (for administrative listing).
   */
  public async findAll(): Promise<WasteTypeRecord[]> {
    const docs = await WasteTypeModel.find().sort({ createdAt: -1 }).lean().exec();

    return docs.map((doc) => ({
      ...doc,
      _id: doc._id.toString(),
    }));
  }

  /**
   * Finds a waste type by its unique slug identifier.
   */
  public async findBySlug(slug: string): Promise<WasteTypeRecord | null> {
    const doc = await WasteTypeModel.findOne({ slug }).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    };
  }

  /**
   * Finds a waste type by MongoDB ObjectId.
   */
  public async findById(id: string): Promise<WasteTypeRecord | null> {
    const doc = await WasteTypeModel.findById(id).lean().exec();
    if (!doc) return null;
    return {
      ...doc,
      _id: doc._id.toString(),
    };
  }

  /**
   * Creates a new waste type in the catalog.
   */
  public async create(data: CreateWasteTypeInput): Promise<WasteTypeRecord> {
    const created = await WasteTypeModel.create({
      ...data,
      isActive: data.isActive ?? true,
    });
    return {
      slug: created.slug,
      name: created.name,
      description: created.description,
      basePrice: created.basePrice,
      ratePerKg: created.ratePerKg,
      commissionRate: created.commissionRate,
      unit: created.unit,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      _id: created._id.toString(),
    };
  }

  /**
   * Updates an existing waste type by ID.
   */
  public async updateById(
    id: string,
    updates: Partial<CreateWasteTypeInput>,
  ): Promise<WasteTypeRecord | null> {
    const doc = await WasteTypeModel.findByIdAndUpdate(
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

  /**
   * Deletes a waste type by ID.
   */
  public async deleteById(id: string): Promise<boolean> {
    const result = await WasteTypeModel.findByIdAndDelete(id).exec();
    return Boolean(result);
  }

  /**
   * Seeds default waste types using upsert for idempotency.
   */
  public async seedDefaults(seeds: DefaultWasteTypeSeed[]): Promise<void> {
    const ops = seeds.map((item) => ({
      updateOne: {
        filter: { slug: item.slug },
        update: { $setOnInsert: { ...item, isActive: true } },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await WasteTypeModel.bulkWrite(ops);
    }
  }
}

export const wasteTypeRepo = new WasteTypeRepo();
