"use server";

import { prisma } from "@/lib/prisma";

export async function acknowledgeAlert(alertId: string, user: string = "system_operator") {
  try {
    // In a real app, we would update the alert in the database.
    // For now, since we haven't seeded alerts, we will just log it.
    // Wait, let's try to update it if it exists.
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (alert) {
      await prisma.alert.update({
        where: { id: alertId },
        data: { acknowledged: true }
      });
    }
    
    // Create an audit log entry (simulated console log for now)
    console.log(`[AUDIT] Alert ${alertId} acknowledged by ${user} at ${new Date().toISOString()}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return { success: false, error: "Failed to acknowledge alert" };
  }
}
