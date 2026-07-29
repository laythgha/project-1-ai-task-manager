-- AlterTable
ALTER TABLE "Tasks" ADD COLUMN     "assignee_id" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "estimated_hours" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'To Do';

-- AddForeignKey
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
