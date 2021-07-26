import {SubscriptionType} from "./SubscriptionType";

export interface UserType {
  name: string,
  icqId: string,
  subscriptions?: SubscriptionType[]
}