-- DropForeignKey
ALTER TABLE "Projects" DROP CONSTRAINT "Projects_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "Reminders" DROP CONSTRAINT "Reminders_task_id_fkey";

-- DropForeignKey
ALTER TABLE "Tasks" DROP CONSTRAINT "Tasks_project_id_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceMembership" DROP CONSTRAINT "WorkspaceMembership_workspace_id_fkey";

-- AddForeignKey
ALTER TABLE "Projects" ADD CONSTRAINT "Projects_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tasks" ADD CONSTRAINT "Tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminders" ADD CONSTRAINT "Reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
