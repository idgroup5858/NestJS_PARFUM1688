import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1793294193823 implements MigrationInterface {
  name = 'Init1793294193823';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" character varying(80) NOT NULL, "name" character varying(100) NOT NULL, "country" character varying(60), CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" character varying(80) NOT NULL, "name" jsonb NOT NULL, "image" character varying(200) NOT NULL DEFAULT '', "group" character varying(10) NOT NULL, "sort" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notes" ("id" character varying(80) NOT NULL, "name" jsonb NOT NULL, "image" character varying(200) NOT NULL DEFAULT '', CONSTRAINT "PK_af6206538ea96c4e77e9f400c3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "accords" ("id" character varying(80) NOT NULL, "name" jsonb NOT NULL, "color" character varying(20) NOT NULL, CONSTRAINT "PK_93eef41cb1391de6dadee264fda" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "products" ("id" character varying(80) NOT NULL, "name" character varying(150) NOT NULL, "brandId" character varying(80) NOT NULL, "categoryIds" jsonb NOT NULL DEFAULT '[]', "gender" character varying(10) NOT NULL, "image" character varying(200) NOT NULL DEFAULT '', "description" jsonb NOT NULL, "notes" jsonb NOT NULL, "accords" jsonb NOT NULL DEFAULT '[]', "season" character varying(12) NOT NULL, "longevity" character varying(12) NOT NULL, "sillage" character varying(12) NOT NULL, "pricePerGram" integer NOT NULL, "bottle" jsonb, "isNew" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_ea86d0c514c4ecbb5694cbf57d" ON "products" ("brandId") `);
    await queryRunner.query(
      `CREATE TABLE "flakons" ("id" character varying(80) NOT NULL, "name" character varying(100) NOT NULL, "volumeMl" integer NOT NULL, "price" integer NOT NULL, "image" character varying(200) NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_4dda7d08ac9308bcb8d08a4e12f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "banners" ("id" character varying(80) NOT NULL, "title" jsonb NOT NULL, "subtitle" jsonb NOT NULL, "button" jsonb NOT NULL, "link" character varying(300) NOT NULL DEFAULT '', "image" character varying(200) NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, "sort" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_e9b186b959296fcb940790d31c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" character varying(80) NOT NULL, "name" character varying(100) NOT NULL DEFAULT '', "phone" character varying(20) NOT NULL DEFAULT '', "telegramId" bigint, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_88acd889fbe17d0e16cc4bc917" ON "customers" ("phone") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_dddeba3546214913002b2bbd10" ON "customers" ("telegramId") WHERE "telegramId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "expense_categories" ("id" character varying(80) NOT NULL, "name" character varying(100) NOT NULL, CONSTRAINT "PK_d0ef31e189d9523461215b62775" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" character varying(80) NOT NULL, "date" character varying(10) NOT NULL, "categoryId" character varying(80) NOT NULL, "amount" bigint NOT NULL, "payment" character varying(10) NOT NULL, "note" character varying(500), "userId" character varying(80) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_280137355ed0f561f9aee0ac2c" ON "expenses" ("date") `);
    await queryRunner.query(`CREATE INDEX "IDX_ac0801a1760c5f9ce43c03bacd" ON "expenses" ("categoryId") `);
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" character varying(80) NOT NULL, "number" integer NOT NULL, "source" character varying(4) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "customerId" character varying(80), "customerName" character varying(100) NOT NULL DEFAULT '', "customerPhone" character varying(20) NOT NULL DEFAULT '', "fulfillment" character varying(10) NOT NULL, "address" character varying(500), "slot" jsonb, "comment" character varying(1000), "lines" jsonb NOT NULL, "deliveryFee" integer NOT NULL DEFAULT '0', "status" character varying(10) NOT NULL, "payment" character varying(10), "cashierId" character varying(80), "history" jsonb NOT NULL, "stockApplied" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e174e347d448617acdf98fef0" ON "orders" ("number") `);
    await queryRunner.query(`CREATE INDEX "IDX_1f4b9818a08b822a31493fdee9" ON "orders" ("createdAt") `);
    await queryRunner.query(`CREATE INDEX "IDX_e5de51ca888d8b1f5ac25799dd" ON "orders" ("customerId") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_d5e3786a82fe691d8bbbb1e256" ON "orders" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" character varying(80) NOT NULL, "productId" character varying(80) NOT NULL, "customerId" character varying(80) NOT NULL, "name" character varying(60) NOT NULL, "rating" smallint NOT NULL, "text" character varying(1000) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "hidden" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_a6b3c434392f5d10ec17104366" ON "reviews" ("productId") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_36e31ae3716d3703c86952a194" ON "reviews" ("customerId", "productId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stock" ("key" character varying(100) NOT NULL, "qty" integer NOT NULL DEFAULT '0', "avgCost" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_ad9cb5d1f2e5f8cad53123dda4d" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "stock_movements" ("id" character varying(80) NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, "key" character varying(100) NOT NULL, "qty" integer NOT NULL, "unitCost" integer NOT NULL, "reason" character varying(12) NOT NULL, "refId" character varying(80), "userId" character varying(80), "costPending" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_e0583ca98ea6cf1a2461c246a8" ON "stock_movements" ("refId") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_8c174f5fabedbb00c4e9bbbc0f" ON "stock_movements" ("key", "at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_subscribers" ("id" bigint NOT NULL, "firstName" character varying(100) NOT NULL DEFAULT '', "lastName" character varying(100), "username" character varying(64), "languageCode" character varying(16), "firstSeen" TIMESTAMP WITH TIME ZONE NOT NULL, "lastSeen" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'active', "messages" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_c87fc352d385cc2c604f6bd24fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_messages" ("id" character varying(80) NOT NULL, "chatId" bigint NOT NULL, "direction" character varying(3) NOT NULL, "name" character varying(150) NOT NULL DEFAULT '', "text" text NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_326e4562c54d0f9dd4d0509e5d5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_1cf8812a41f1321c7f30246abf" ON "telegram_messages" ("at") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_2e3a6adbe7314f065c56f1b9b7" ON "telegram_messages" ("chatId", "at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_broadcasts" ("id" character varying(80) NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, "text" text NOT NULL, "audience" character varying(20) NOT NULL, "total" integer NOT NULL DEFAULT '0', "sent" integer NOT NULL DEFAULT '0', "failed" integer NOT NULL DEFAULT '0', "blocked" integer NOT NULL DEFAULT '0', "status" character varying(10) NOT NULL, "userId" character varying(80) NOT NULL, CONSTRAINT "PK_41c03e584f600343b098959aac0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_7b728c70f55f969b7b39ea50ef" ON "telegram_broadcasts" ("at") `);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" character varying(80) NOT NULL, "name" character varying(100) NOT NULL, "role" character varying(16) NOT NULL, "pinDigest" character varying(64) NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_26e4c625674d4336d23123e1df" ON "users" ("pinDigest") `);
    await queryRunner.query(
      `CREATE TABLE "suppliers" ("id" character varying(80) NOT NULL, "name" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL DEFAULT '', "note" character varying(500), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "purchases" ("id" character varying(80) NOT NULL, "number" integer NOT NULL, "date" character varying(10) NOT NULL, "supplierId" character varying(80) NOT NULL, "lines" jsonb NOT NULL, "total" bigint NOT NULL, "note" character varying(500), "userId" character varying(80) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_1d55032f37a34c6eceacbbca6b8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a3744e944a0621e780233ca992" ON "purchases" ("number") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_b2a6247462009113874b82df6c" ON "purchases" ("date") `);
    await queryRunner.query(`CREATE INDEX "IDX_77980c752fdeb3689e318fde42" ON "purchases" ("supplierId") `);
    await queryRunner.query(
      `CREATE TABLE "supplier_payments" ("id" character varying(80) NOT NULL, "date" character varying(10) NOT NULL, "supplierId" character varying(80) NOT NULL, "amount" bigint NOT NULL, "purchaseId" character varying(80), "note" character varying(500), "userId" character varying(80) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_76e86f3194494faf999c652dbf9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_e1264ca4e7d03ad1ff6e8cc596" ON "supplier_payments" ("date") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_a9606c250851fd546b0669925a" ON "supplier_payments" ("supplierId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inventories" ("id" character varying(80) NOT NULL, "number" integer NOT NULL, "date" character varying(10) NOT NULL, "lines" jsonb NOT NULL, "note" character varying(500), "userId" character varying(80) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7b1946392ffdcb50cfc6ac78c0e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fafd16e0f1091a056944788aa3" ON "inventories" ("number") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_327ba506d8fd1d6d46277fd208" ON "inventories" ("date") `);
    await queryRunner.query(
      `CREATE TABLE "write_offs" ("id" character varying(80) NOT NULL, "number" integer NOT NULL, "date" character varying(10) NOT NULL, "reason" character varying(10) NOT NULL, "lines" jsonb NOT NULL, "note" character varying(500), "userId" character varying(80) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_5ea700b624a2713f69dcf5998ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c9140efac194217da97ef2ea36" ON "write_offs" ("number") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_76e78fad9f92a3776dadbc5f19" ON "write_offs" ("date") `);
    await queryRunner.query(
      `CREATE TABLE "counters" ("key" character varying(40) NOT NULL, "value" integer NOT NULL, CONSTRAINT "PK_c6c33328f872db2d0aaabbacbc8" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "settings" ("key" character varying(60) NOT NULL, "value" jsonb NOT NULL, CONSTRAINT "PK_c8639b7626fa94ba8265628f214" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_ea86d0c514c4ecbb5694cbf57df" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_a6b3c434392f5d10ec171043666" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchases" ADD CONSTRAINT "FK_77980c752fdeb3689e318fde424" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_a9606c250851fd546b0669925a4" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_a9606c250851fd546b0669925a4"`,
    );
    await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_77980c752fdeb3689e318fde424"`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_a6b3c434392f5d10ec171043666"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_ac0801a1760c5f9ce43c03bacd0"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_ea86d0c514c4ecbb5694cbf57df"`);
    await queryRunner.query(`DROP TABLE "settings"`);
    await queryRunner.query(`DROP TABLE "counters"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_76e78fad9f92a3776dadbc5f19"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c9140efac194217da97ef2ea36"`);
    await queryRunner.query(`DROP TABLE "write_offs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_327ba506d8fd1d6d46277fd208"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_fafd16e0f1091a056944788aa3"`);
    await queryRunner.query(`DROP TABLE "inventories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a9606c250851fd546b0669925a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e1264ca4e7d03ad1ff6e8cc596"`);
    await queryRunner.query(`DROP TABLE "supplier_payments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_77980c752fdeb3689e318fde42"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b2a6247462009113874b82df6c"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a3744e944a0621e780233ca992"`);
    await queryRunner.query(`DROP TABLE "purchases"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_26e4c625674d4336d23123e1df"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7b728c70f55f969b7b39ea50ef"`);
    await queryRunner.query(`DROP TABLE "telegram_broadcasts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2e3a6adbe7314f065c56f1b9b7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1cf8812a41f1321c7f30246abf"`);
    await queryRunner.query(`DROP TABLE "telegram_messages"`);
    await queryRunner.query(`DROP TABLE "telegram_subscribers"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8c174f5fabedbb00c4e9bbbc0f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e0583ca98ea6cf1a2461c246a8"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP TABLE "stock"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_36e31ae3716d3703c86952a194"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a6b3c434392f5d10ec17104366"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d5e3786a82fe691d8bbbb1e256"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e5de51ca888d8b1f5ac25799dd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1f4b9818a08b822a31493fdee9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e174e347d448617acdf98fef0"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ac0801a1760c5f9ce43c03bacd"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_280137355ed0f561f9aee0ac2c"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
    await queryRunner.query(`DROP TABLE "expense_categories"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_dddeba3546214913002b2bbd10"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_88acd889fbe17d0e16cc4bc917"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP TABLE "banners"`);
    await queryRunner.query(`DROP TABLE "flakons"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ea86d0c514c4ecbb5694cbf57d"`);
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`DROP TABLE "accords"`);
    await queryRunner.query(`DROP TABLE "notes"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "brands"`);
  }
}
