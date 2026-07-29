-- AlterTable
ALTER TABLE "Reminders" ADD COLUMN     "user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Reminders" ADD CONSTRAINT "Reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
