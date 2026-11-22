CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'MERCHANT', 'DRIVER', 'ADMIN');
CREATE TYPE "order_status" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED'
);

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'CUSTOMER',
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "full_name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stores" (
  "id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "logo_url" TEXT,
  "address" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "location" geometry(Point, 4326),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "preparation_time_mins" INTEGER NOT NULL,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stores_preparation_time_mins_nonnegative"
    CHECK ("preparation_time_mins" >= 0)
);

CREATE TABLE "categories" (
  "id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "icon_url" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_cents" INTEGER NOT NULL,
  "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  "image_url" TEXT,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_cents_nonnegative" CHECK ("price_cents" >= 0),
  CONSTRAINT "products_stock_quantity_nonnegative" CHECK ("stock_quantity" >= 0)
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "store_id" UUID NOT NULL,
  "driver_id" UUID,
  "status" "order_status" NOT NULL DEFAULT 'PENDING',
  "subtotal_cents" INTEGER NOT NULL,
  "delivery_fee_cents" INTEGER NOT NULL,
  "total_amount_cents" INTEGER NOT NULL,
  "delivery_address" TEXT NOT NULL,
  "delivery_lat" DOUBLE PRECISION NOT NULL,
  "delivery_lng" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_amounts_nonnegative" CHECK (
    "subtotal_cents" >= 0
    AND "delivery_fee_cents" >= 0
    AND "total_amount_cents"::BIGINT
      = "subtotal_cents"::BIGINT + "delivery_fee_cents"::BIGINT
  )
);

CREATE TABLE "order_items" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "total_price_cents" INTEGER NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_amounts_positive" CHECK (
    "quantity" > 0
    AND "unit_price_cents" >= 0
    AND "total_price_cents"::BIGINT
      = "quantity"::BIGINT * "unit_price_cents"::BIGINT
  )
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payload_json" JSONB,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "stores_owner_id_idx" ON "stores"("owner_id");
CREATE INDEX "stores_is_active_idx" ON "stores"("is_active");
CREATE INDEX "stores_location_gist_idx" ON "stores" USING GIST ("location");
CREATE UNIQUE INDEX "categories_store_id_name_key" ON "categories"("store_id", "name");
CREATE INDEX "categories_store_id_display_order_idx" ON "categories"("store_id", "display_order");
CREATE INDEX "products_store_id_is_available_idx" ON "products"("store_id", "is_available");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");
CREATE INDEX "orders_store_id_status_created_at_idx" ON "orders"("store_id", "status", "created_at");
CREATE INDEX "orders_driver_id_status_idx" ON "orders"("driver_id", "status");
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX "notifications_user_id_is_read_created_at_idx"
  ON "notifications"("user_id", "is_read", "created_at");

ALTER TABLE "stores"
  ADD CONSTRAINT "stores_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products"
  ADD CONSTRAINT "products_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "orders_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "orders_driver_id_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "sync_store_location"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."location" := ST_SetSRID(ST_MakePoint(NEW."longitude", NEW."latitude"), 4326);
  RETURN NEW;
END;
$$;

CREATE TRIGGER "stores_sync_location"
BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "stores"
FOR EACH ROW EXECUTE FUNCTION "sync_store_location"();

CREATE FUNCTION "enforce_product_category_store"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  category_store_id UUID;
BEGIN
  SELECT "store_id" INTO category_store_id
  FROM "categories"
  WHERE "id" = NEW."category_id";

  IF category_store_id IS DISTINCT FROM NEW."store_id" THEN
    RAISE EXCEPTION 'Product category must belong to the same store'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_validate_category_store"
BEFORE INSERT OR UPDATE OF "store_id", "category_id" ON "products"
FOR EACH ROW EXECUTE FUNCTION "enforce_product_category_store"();

CREATE FUNCTION "enforce_category_existing_products"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."store_id" IS DISTINCT FROM NEW."store_id"
    AND EXISTS (
      SELECT 1 FROM "products"
      WHERE "category_id" = NEW."id"
        AND "store_id" IS DISTINCT FROM NEW."store_id"
    )
  THEN
    RAISE EXCEPTION 'A category with products cannot move to another store'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "categories_validate_existing_products"
BEFORE UPDATE OF "store_id" ON "categories"
FOR EACH ROW EXECUTE FUNCTION "enforce_category_existing_products"();

CREATE FUNCTION "enforce_product_existing_orders"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."store_id" IS DISTINCT FROM NEW."store_id"
    AND EXISTS (
      SELECT 1
      FROM "order_items" AS item
      JOIN "orders" AS customer_order ON customer_order."id" = item."order_id"
      WHERE item."product_id" = NEW."id"
        AND customer_order."store_id" IS DISTINCT FROM NEW."store_id"
    )
  THEN
    RAISE EXCEPTION 'A product referenced by an order cannot move to another store'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "products_validate_existing_orders"
BEFORE UPDATE OF "store_id" ON "products"
FOR EACH ROW EXECUTE FUNCTION "enforce_product_existing_orders"();

CREATE FUNCTION "enforce_order_item_store"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  order_store_id UUID;
  product_store_id UUID;
BEGIN
  SELECT "store_id" INTO order_store_id FROM "orders" WHERE "id" = NEW."order_id";
  SELECT "store_id" INTO product_store_id FROM "products" WHERE "id" = NEW."product_id";

  IF order_store_id IS DISTINCT FROM product_store_id THEN
    RAISE EXCEPTION 'Order items must belong to the order store'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "order_items_validate_store"
BEFORE INSERT OR UPDATE OF "order_id", "product_id" ON "order_items"
FOR EACH ROW EXECUTE FUNCTION "enforce_order_item_store"();

CREATE FUNCTION "enforce_order_store_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."store_id" IS DISTINCT FROM NEW."store_id"
    AND EXISTS (
      SELECT 1
      FROM "order_items" AS item
      JOIN "products" AS product ON product."id" = item."product_id"
      WHERE item."order_id" = NEW."id"
        AND product."store_id" IS DISTINCT FROM NEW."store_id"
    )
  THEN
    RAISE EXCEPTION 'Order store cannot differ from its item stores'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "orders_validate_store_update"
BEFORE UPDATE OF "store_id" ON "orders"
FOR EACH ROW EXECUTE FUNCTION "enforce_order_store_update"();

CREATE FUNCTION "assert_order_subtotal"(target_order_id UUID) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  expected_subtotal INTEGER;
  items_subtotal BIGINT;
  item_count BIGINT;
BEGIN
  SELECT "subtotal_cents" INTO expected_subtotal
  FROM "orders"
  WHERE "id" = target_order_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM("total_price_cents"::BIGINT), 0), COUNT(*)
    INTO items_subtotal, item_count
  FROM "order_items"
  WHERE "order_id" = target_order_id;

  IF item_count = 0 OR items_subtotal <> expected_subtotal THEN
    RAISE EXCEPTION 'Order subtotal must equal the sum of its order items'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION "validate_order_subtotal"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    PERFORM "assert_order_subtotal"(NEW."id");
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM "assert_order_subtotal"(OLD."order_id");
  ELSE
    PERFORM "assert_order_subtotal"(OLD."order_id");
    IF OLD."order_id" IS DISTINCT FROM NEW."order_id" THEN
      PERFORM "assert_order_subtotal"(NEW."order_id");
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "orders_subtotal_matches_items"
AFTER INSERT OR UPDATE ON "orders"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_order_subtotal"();

CREATE CONSTRAINT TRIGGER "order_items_match_order_subtotal"
AFTER INSERT OR UPDATE OR DELETE ON "order_items"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_order_subtotal"();
