import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { hashPassword } from "@/lib/auth";

export const runtime = "nodejs";

async function isSeeded(): Promise<boolean> {
  const admin = await db.user.findUnique({ where: { email: "admin@ex-ims.dev" } });
  return !!admin;
}

export const GET = withErrorHandling(async () => {
  const [users, items, categories, requests] = await Promise.all([
    db.user.count(),
    db.item.count(),
    db.category.count(),
    db.itemRequest.count(),
  ]);
  return NextResponse.json({ seeded: users > 0, counts: { users, items, categories, requests } });
});

export const POST = withErrorHandling(async (_req: NextRequest) => {
  if (await isSeeded()) {
    return NextResponse.json({ ok: true, seeded: true, message: "Database already seeded" });
  }

  const [adminHash, managerHash, clerkHash, staffHash] = await Promise.all([
    hashPassword("Admin@123"),
    hashPassword("Manager@123"),
    hashPassword("Clerk@123"),
    hashPassword("Staff@123"),
  ]);

  const admin = await db.user.create({
    data: {
      empId: "EMP-0001", email: "admin@ex-ims.dev", passwordHash: adminHash,
      firstName: "Alex", lastName: "Morgan", role: "ADMIN",
      department: "IT Services", office: "Block A-101", phone: "+251-911-000-001",
    },
  });
  const manager = await db.user.create({
    data: {
      empId: "EMP-0002", email: "manager@ex-ims.dev", passwordHash: managerHash,
      firstName: "Maya", lastName: "Chen", role: "MANAGER",
      department: "Operations", office: "Block B-204", phone: "+251-911-000-002",
    },
  });
  const clerk = await db.user.create({
    data: {
      empId: "EMP-0003", email: "clerk@ex-ims.dev", passwordHash: clerkHash,
      firstName: "Sam", lastName: "Okafor", role: "STOREKEEPER",
      department: "Central Store", office: "Store Room 1", phone: "+251-911-000-003",
    },
  });
  const staff = await db.user.create({
    data: {
      empId: "EMP-0004", email: "staff@ex-ims.dev", passwordHash: staffHash,
      firstName: "Lina", lastName: "Tesfaye", role: "STAFF",
      department: "Computer Science", office: "Block C-12", phone: "+251-911-000-004",
    },
  });
  await db.user.create({
    data: {
      empId: "EMP-0005", email: "daniel@ex-ims.dev", passwordHash: staffHash,
      firstName: "Daniel", lastName: "Bekele", role: "STAFF",
      department: "Physics", office: "Block C-08", phone: "+251-911-000-005",
    },
  });

  const catData = [
    ["Electronics", "Computers, displays, peripherals and AV equipment"],
    ["Furniture", "Desks, chairs, shelving and laboratory benches"],
    ["Lab Equipment", "Scientific instruments and laboratory apparatus"],
    ["Office Supplies", "Stationery, paper and general consumables"],
    ["Network Equipment", "Switches, routers, cables and patch panels"],
    ["Cleaning Supplies", "Sanitation and janitorial consumables"],
    ["Projectors & AV", "Projectors, screens and presentation equipment"],
  ];
  const cats: Record<string, string> = {};
  for (const [name, description] of catData) {
    const c = await db.category.create({ data: { name, description } });
    cats[name] = c.id;
  }

  type SeedItem = {
    code: string; name: string; category: string; brand?: string; model?: string;
    serial?: string; unit?: string; quantity: number; minStockLevel?: number;
    unitPrice: number; location?: string; description?: string;
  };
  const items: SeedItem[] = [
    { code: "ITM-1001", name: "Dell Latitude 5540 Laptop", category: "Electronics", brand: "Dell", model: "Latitude 5540", unit: "pcs", quantity: 24, minStockLevel: 6, unitPrice: 950, location: "Store A / Shelf 1", description: "Core i7, 16GB RAM, 512GB SSD — departmental loan pool" },
    { code: "ITM-1002", name: "HP LaserJet Pro Printer", category: "Electronics", brand: "HP", model: "M404dn", unit: "pcs", quantity: 7, minStockLevel: 3, unitPrice: 320, location: "Store A / Shelf 2" },
    { code: "ITM-1003", name: "27-inch LED Monitor", category: "Electronics", brand: "Samsung", model: "S27A600", unit: "pcs", quantity: 31, minStockLevel: 10, unitPrice: 210, location: "Store A / Shelf 3" },
    { code: "ITM-1004", name: "USB-C Docking Station", category: "Electronics", brand: "Lenovo", model: "TP-Dock", unit: "pcs", quantity: 4, minStockLevel: 8, unitPrice: 165, location: "Store A / Shelf 1", description: "For laptop users — low stock" },
    { code: "ITM-1005", name: "External DVD Writer", category: "Electronics", brand: "LG", unit: "pcs", quantity: 0, minStockLevel: 4, unitPrice: 45, location: "Store A / Shelf 4" },
    { code: "ITM-2001", name: "Ergonomic Office Chair", category: "Furniture", brand: "Herman", unit: "pcs", quantity: 42, minStockLevel: 10, unitPrice: 180, location: "Store B / Rack 1" },
    { code: "ITM-2002", name: "Adjustable Standing Desk", category: "Furniture", brand: "FlexiSpot", model: "E7", unit: "pcs", quantity: 12, minStockLevel: 5, unitPrice: 420, location: "Store B / Rack 2" },
    { code: "ITM-2003", name: "Steel Bookshelf 5-tier", category: "Furniture", unit: "pcs", quantity: 18, minStockLevel: 4, unitPrice: 95, location: "Store B / Rack 2" },
    { code: "ITM-2004", name: "Lab Stool (height adjustable)", category: "Furniture", unit: "pcs", quantity: 9, minStockLevel: 12, unitPrice: 70, location: "Store B / Rack 3" },
    { code: "ITM-3001", name: "Digital Oscilloscope 100MHz", category: "Lab Equipment", brand: "Rigol", model: "DS1104Z", serial: "RGL-2024-0887", unit: "pcs", quantity: 6, minStockLevel: 2, unitPrice: 1200, location: "Lab Store / Cabinet 1" },
    { code: "ITM-3002", name: "Microscope Binocular 40x-1000x", category: "Lab Equipment", brand: "Olympus", serial: "OLY-8842", unit: "pcs", quantity: 15, minStockLevel: 4, unitPrice: 680, location: "Lab Store / Cabinet 2" },
    { code: "ITM-3003", name: "Precision Balance 0.001g", category: "Lab Equipment", brand: "Mettler", unit: "pcs", quantity: 3, minStockLevel: 3, unitPrice: 940, location: "Lab Store / Cabinet 1" },
    { code: "ITM-3004", name: "Centrifuge Benchtop 4000rpm", category: "Lab Equipment", brand: "Hettich", unit: "pcs", quantity: 2, minStockLevel: 2, unitPrice: 1500, location: "Lab Store / Cabinet 3" },
    { code: "ITM-4001", name: "A4 Copy Paper 80gsm", category: "Office Supplies", unit: "box", quantity: 120, minStockLevel: 40, unitPrice: 6.5, location: "Store C / Pallet 1", description: "Reamed boxes of 5" },
    { code: "ITM-4002", name: "Permanent Marker Set", category: "Office Supplies", unit: "set", quantity: 65, minStockLevel: 20, unitPrice: 3.2, location: "Store C / Bin 4" },
    { code: "ITM-4003", name: "Whiteboard Marker (box 12)", category: "Office Supplies", unit: "box", quantity: 14, minStockLevel: 15, unitPrice: 8.4, location: "Store C / Bin 4" },
    { code: "ITM-4004", name: "Stapler Heavy Duty", category: "Office Supplies", brand: "Rapesco", unit: "pcs", quantity: 28, minStockLevel: 10, unitPrice: 12, location: "Store C / Bin 2" },
    { code: "ITM-5001", name: "24-Port Gigabit Switch", category: "Network Equipment", brand: "TP-Link", model: "TL-SG1024", unit: "pcs", quantity: 9, minStockLevel: 3, unitPrice: 140, location: "Network Cage / Bin 1" },
    { code: "ITM-5002", name: "Cat6 Patch Cable 2m", category: "Network Equipment", unit: "pcs", quantity: 240, minStockLevel: 80, unitPrice: 2.1, location: "Network Cage / Bin 2" },
    { code: "ITM-5003", name: "Wireless Access Point Wi-Fi 6", category: "Network Equipment", brand: "Ubiquiti", model: "U6-Pro", unit: "pcs", quantity: 5, minStockLevel: 6, unitPrice: 189, location: "Network Cage / Bin 3" },
    { code: "ITM-5004", name: "Rack-mount UPS 1500VA", category: "Network Equipment", brand: "APC", unit: "pcs", quantity: 3, minStockLevel: 2, unitPrice: 560, location: "Network Cage / Rack" },
    { code: "ITM-6001", name: "Disinfectant Surface Spray", category: "Cleaning Supplies", unit: "btl", quantity: 88, minStockLevel: 30, unitPrice: 4.5, location: "Store D / Shelf 1" },
    { code: "ITM-6002", name: "Paper Towel Roll", category: "Cleaning Supplies", unit: "roll", quantity: 0, minStockLevel: 50, unitPrice: 1.8, location: "Store D / Shelf 2" },
    { code: "ITM-7001", name: "Multimedia Projector 4000lm", category: "Projectors & AV", brand: "Epson", model: "EB-FH52", serial: "EPS-2291", unit: "pcs", quantity: 11, minStockLevel: 4, unitPrice: 780, location: "AV Store / Cabinet 1" },
    { code: "ITM-7002", name: "Portable Projection Screen 100in", category: "Projectors & AV", unit: "pcs", quantity: 8, minStockLevel: 3, unitPrice: 120, location: "AV Store / Cabinet 2" },
    { code: "ITM-7003", name: "Wireless Presenter Remote", category: "Projectors & AV", brand: "Logitech", unit: "pcs", quantity: 22, minStockLevel: 10, unitPrice: 32, location: "AV Store / Bin 1" },
  ];

  const itemIds: Record<string, string> = {};
  for (const it of items) {
    const created = await db.item.create({
      data: {
        code: it.code,
        name: it.name,
        categoryId: cats[it.category],
        brand: it.brand ?? null,
        model: it.model ?? null,
        serial: it.serial ?? null,
        unit: it.unit ?? "pcs",
        quantity: it.quantity,
        minStockLevel: it.minStockLevel ?? 5,
        unitPrice: it.unitPrice,
        location: it.location ?? null,
        description: it.description ?? null,
        status: it.quantity <= 0 ? "OUT_OF_STOCK" : "AVAILABLE",
        createdById: clerk.id,
      },
    });
    itemIds[it.code] = created.id;
    await db.stockMovement.create({
      data: {
        itemId: created.id,
        type: "IN",
        quantity: it.quantity,
        reference: "INITIAL",
        note: "Opening stock",
        userId: clerk.id,
        createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000),
      },
    });
  }

  const now = Date.now();
  const mkReq = async (params: {
    code: string; requesterId: string; quantity: number; status: string;
    reason?: string; decisionNote?: string; reviewerId?: string;
    daysAgo: number; issuedDaysAgo?: number; returnedDaysAgo?: number;
  }) => {
    const itemId = itemIds[params.code];
    return db.itemRequest.create({
      data: {
        itemId,
        requesterId: params.requesterId,
        quantity: params.quantity,
        reason: params.reason ?? null,
        status: params.status,
        reviewerId: params.reviewerId ?? null,
        reviewedAt: params.reviewerId ? new Date(now - params.daysAgo * 86400000 + 3600000) : null,
        decisionNote: params.decisionNote ?? null,
        issuedAt: params.issuedDaysAgo ? new Date(now - params.issuedDaysAgo * 86400000) : null,
        returnedAt: params.returnedDaysAgo ? new Date(now - params.returnedDaysAgo * 86400000) : null,
        createdAt: new Date(now - params.daysAgo * 86400000),
      },
    });
  };

  const r1 = await mkReq({ code: "ITM-1001", requesterId: staff.id, quantity: 2, status: "ISSUED", reason: "Semester lab sessions for CS juniors", reviewerId: clerk.id, decisionNote: "Approved for departmental lab use", daysAgo: 5, issuedDaysAgo: 4 });
  await mkReq({ code: "ITM-7001", requesterId: staff.id, quantity: 1, status: "RETURNED", reason: "Guest lecture presentation", reviewerId: clerk.id, daysAgo: 9, issuedDaysAgo: 8, returnedDaysAgo: 7 });
  await mkReq({ code: "ITM-4001", requesterId: (await db.user.findUnique({ where: { empId: "EMP-0005" } }))!.id, quantity: 10, status: "PENDING", reason: "Mid-term exam printing", daysAgo: 1 });
  await mkReq({ code: "ITM-3002", requesterId: (await db.user.findUnique({ where: { empId: "EMP-0005" } }))!.id, quantity: 3, status: "APPROVED", reason: "Biology practical class", reviewerId: manager.id, decisionNote: "Return within two weeks", daysAgo: 2 });
  await mkReq({ code: "ITM-1005", requesterId: staff.id, quantity: 1, status: "REJECTED", reason: "Archive digitization project", reviewerId: clerk.id, decisionNote: "Out of stock — pending restock", daysAgo: 3 });
  await mkReq({ code: "ITM-5002", requesterId: staff.id, quantity: 12, status: "ISSUED", reason: "Server room re-cabling", reviewerId: clerk.id, daysAgo: 6, issuedDaysAgo: 5 });
  await mkReq({ code: "ITM-7003", requesterId: staff.id, quantity: 2, status: "PENDING", reason: "Conference room setups", daysAgo: 0 });
  await mkReq({ code: "ITM-2001", requesterId: (await db.user.findUnique({ where: { empId: "EMP-0005" } }))!.id, quantity: 4, status: "CANCELLED", reason: "Office refit (cancelled by facilities)", daysAgo: 7 });

  // OUT movements for issued requests
  for (const req of [r1]) {
    await db.stockMovement.create({
      data: {
        itemId: req.itemId,
        type: "OUT",
        quantity: req.quantity,
        reference: req.id,
        note: "Issued to Lina Tesfaye (EMP-0004)",
        userId: clerk.id,
        createdAt: new Date(now - 4 * 86400000),
      },
    });
  }

  await db.comment.createMany({
    data: [
      { itemId: itemIds["ITM-1001"], userId: manager.id, body: "Reminder: loan pool laptops must be returned before the semester break." },
      { itemId: itemIds["ITM-1001"], userId: clerk.id, body: "Two units are with the CS department — due back next week." },
      { itemId: itemIds["ITM-1004"], userId: clerk.id, body: "Purchase requisition #PR-118 raised for 10 more docks." },
      { itemId: itemIds["ITM-3001"], userId: staff.id, body: "Calibration certificate for unit 3 expires next month." },
    ],
  });

  await db.auditLog.createMany({
    data: [
      { userId: admin.id, actorName: "Alex Morgan", action: "SYSTEM_SEED", entity: "AUTH", details: "Demo dataset provisioned (4 roles, 7 categories, 26 items)", createdAt: new Date(now - 8 * 86400000) },
      { userId: clerk.id, actorName: "Sam Okafor", action: "ITEM_CREATE", entity: "ITEM", details: "Opening stock registered for 26 items", createdAt: new Date(now - 8 * 86400000) },
      { userId: staff.id, actorName: "Lina Tesfaye", action: "REQUEST_CREATE", entity: "REQUEST", entityId: r1.id, details: "Lina Tesfaye requested 2 pcs of Dell Latitude 5540 Laptop", createdAt: new Date(now - 5 * 86400000) },
      { userId: clerk.id, actorName: "Sam Okafor", action: "REQUEST_APPROVE", entity: "REQUEST", entityId: r1.id, details: "Approved request for 2 pcs of Dell Latitude 5540 Laptop", createdAt: new Date(now - 4.5 * 86400000) },
      { userId: clerk.id, actorName: "Sam Okafor", action: "REQUEST_ISSUE", entity: "REQUEST", entityId: r1.id, details: "Issued 2 pcs of Dell Latitude 5540 Laptop to Lina Tesfaye", createdAt: new Date(now - 4 * 86400000) },
    ],
  });

  return NextResponse.json({
    ok: true,
    seeded: true,
    message: "Seeded 5 users, 7 categories, 26 items, 8 requests, movements, comments and audit trail",
  });
});
