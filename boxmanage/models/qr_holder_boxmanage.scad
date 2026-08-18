// ============================================================
// BoxManage QR Holder - Parametric
// Parametric clip/frame that holds a QR code label and attaches
// to the edge or face of a storage box.
// ============================================================

/* [QR Code Settings] */
// Size of the QR code square (mm) - measure your printed sticker
qr_size = 30; // [15:100]

// Thickness of the pocket that holds the QR sticker (mm)
qr_pocket_depth = 1.5; // [0.5:0.1:3]

/* [Frame Settings] */
// Border width around the QR code (mm)
frame_border = 4; // [2:10]

// Overall thickness of the holder (mm)
frame_thickness = 3; // [2:8]

// Corner rounding radius (mm)
corner_radius = 3; // [0:0.5:8]

/* [Mounting] */
// Mounting style: "clip" = snaps onto box edge, "flat" = flat plate for glue/screw, "hole" = flat plate with screw holes
mount_type = "clip"; // [clip, flat, hole]

// --- Clip settings (used if mount_type = "clip") ---
// Thickness of the box wall/edge the clip grips (mm)
box_wall_thickness = 3; // [1:0.5:8]

// Depth of the clip that wraps around the edge (mm)
clip_depth = 15; // [8:40]

// Extra clearance so the clip isn't too tight (mm)
clip_clearance = 0.4; // [0:0.1:1]

// --- Screw hole settings (used if mount_type = "hole") ---
screw_hole_diameter = 3.2; // [2:0.1:6]
screw_hole_inset = 4; // distance from edge to hole center

/* [Rendering] */
$fn = 48;

// ============================================================
// Derived dimensions
// ============================================================
outer_size = qr_size + frame_border * 2;

// ============================================================
// Modules
// ============================================================

module rounded_square(size, radius) {
    hull() {
        for (x = [radius, size - radius])
            for (y = [radius, size - radius])
                translate([x, y, 0])
                    circle(r = radius);
    }
}

module qr_plate() {
    // Base plate with rounded corners
    linear_extrude(height = frame_thickness)
        rounded_square(outer_size, corner_radius);
}

module qr_pocket_cut() {
    // Recessed pocket for the QR sticker, centered, cut from the top
    translate([frame_border, frame_border, frame_thickness - qr_pocket_depth])
        cube([qr_size, qr_size, qr_pocket_depth + 0.5]);
}

module screw_holes() {
    positions = [
        [screw_hole_inset, screw_hole_inset],
        [outer_size - screw_hole_inset, screw_hole_inset],
        [screw_hole_inset, outer_size - screw_hole_inset],
        [outer_size - screw_hole_inset, outer_size - screw_hole_inset]
    ];
    for (p = positions)
        translate([p[0], p[1], -0.5])
            cylinder(h = frame_thickness + 1, d = screw_hole_diameter);
}

module clip_wrap() {
    // Wraps around the box edge: front plate + back tab, gripping box_wall_thickness
    gap = box_wall_thickness + clip_clearance;

    // Back tab (behind the box wall)
    translate([0, -clip_depth, 0])
        cube([outer_size, clip_depth, frame_thickness]);

    // Bridge connecting front plate to back tab, over the top edge of the wall
    translate([0, -gap - frame_thickness, 0])
        cube([outer_size, gap + frame_thickness, frame_thickness]);
}

// ============================================================
// Assembly
// ============================================================

module qr_holder() {
    difference() {
        union() {
            qr_plate();
            if (mount_type == "clip")
                clip_wrap();
        }
        qr_pocket_cut();
        if (mount_type == "hole")
            screw_holes();
    }
}

qr_holder();
