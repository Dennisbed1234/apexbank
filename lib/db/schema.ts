import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  bigint,
} from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  phone: text('phone'),
  dateOfBirth: text('dateOfBirth'),
  addressLine1: text('addressLine1'),
  addressLine2: text('addressLine2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postalCode'),
  selectedProduct: text('selectedProduct'),
  extraProducts: text('extraProducts'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
