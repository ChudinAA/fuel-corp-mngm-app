
import { UserStorage } from "./user-storage";
import { RoleStorage } from "./role-storage";
import { CustomerStorage } from "./customer-storage";
import { WholesaleStorage } from "./wholesale-storage";
import { RefuelingStorage } from "./refueling-storage";
import { LogisticsStorage } from "./logistics-storage";
import { PriceStorage } from "./price-storage";
import { OperationsStorage } from "./operations-storage";

export * from "./types";

export class Storage {
  public users: UserStorage;
  public roles: RoleStorage;
  public customers: CustomerStorage;
  public wholesale: WholesaleStorage;
  public refueling: RefuelingStorage;
  public logistics: LogisticsStorage;
  public prices: PriceStorage;
  public operations: OperationsStorage;

  constructor() {
    this.users = new UserStorage();
    this.roles = new RoleStorage();
    this.customers = new CustomerStorage();
    this.wholesale = new WholesaleStorage();
    this.refueling = new RefuelingStorage();
    this.logistics = new LogisticsStorage();
    this.prices = new PriceStorage();
    this.operations = new OperationsStorage();
  }
}

export const storage = new Storage();
