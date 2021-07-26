const accessType_1List = ['Ижевск', 'поставщик', 'со склада', 'с центрального склада', 'дизайн', 'доставка', 'Ижевск + центральный склад', 'со склада другого филиала', 'сервис-24', 'Сарапул', 'металл', 'Ижевск+Сарапул', 'Полиросс'] as const;
type ElementType < T extends ReadonlyArray < unknown > > = T extends ReadonlyArray<
    infer ElementType
    >
  ? ElementType
  : never
export type AccessType_1Type = ElementType<typeof accessType_1List>