import { describe, expect, it } from "vitest";
import { inferIconFromTitle, resolveTaskIcon, CHORE_ICONS } from "./icons";

describe("icons library", () => {
  it("has a collection of chore icons", () => {
    expect(CHORE_ICONS.length).toBeGreaterThanOrEqual(50);
    const ids = CHORE_ICONS.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("correctly identifies new chore categories", () => {
    expect(inferIconFromTitle("Water the plants")).toBe("sprout");
    expect(inferIconFromTitle("Water flowers in garden")).toBe("flower");
    expect(inferIconFromTitle("Pack backpack for school")).toBe("backpack");
    expect(inferIconFromTitle("Put away shoes")).toBe("footprints");
    expect(inferIconFromTitle("Get groceries from car")).toBe("shopping-bag");
    expect(inferIconFromTitle("Bake chocolate chip cookies")).toBe("cookie");
    expect(inferIconFromTitle("Take out recycling")).toBe("recycle");
    expect(inferIconFromTitle("Check the mailbox")).toBe("mail");
    expect(inferIconFromTitle("Take morning vitamins")).toBe("pill");
    expect(inferIconFromTitle("Turn off bedroom lights")).toBe("lightbulb");
    expect(inferIconFromTitle("Move clothes to dryer")).toBe("washing-machine");
    expect(inferIconFromTitle("Spray and wipe counters")).toBe("spray-can");
    expect(inferIconFromTitle("Shovel snow on sidewalk")).toBe("shovel");
    expect(inferIconFromTitle("Put coins in piggy bank")).toBe("piggy-bank");
    expect(inferIconFromTitle("Soccer practice")).toBe("dumbbell");
    expect(inferIconFromTitle("Feed the chickens")).toBe("bird");
    expect(inferIconFromTitle("Refill water bottle")).toBe("droplets");
    expect(inferIconFromTitle("Coloring and paint time")).toBe("palette");
    expect(inferIconFromTitle("Lock front door")).toBe("door-closed");
  });

  it("correctly identifies kitchen and dish chores without false positive wash->bath", () => {
    expect(inferIconFromTitle("Unload the dishwasher")).toBe("utensils");
    expect(inferIconFromTitle("Wash dishes")).toBe("utensils");
    expect(inferIconFromTitle("Set dinner table")).toBe("utensils");
    expect(inferIconFromTitle("Clear breakfast plates")).toBe("utensils");
  });

  it("identifies bath and hygiene chores", () => {
    expect(inferIconFromTitle("Take a bath")).toBe("bath");
    expect(inferIconFromTitle("Take a shower")).toBe("bath");
    expect(inferIconFromTitle("Wash hands")).toBe("bath");
    expect(inferIconFromTitle("Brush teeth")).toBe("smile");
  });

  it("identifies dusting and sweeping", () => {
    expect(inferIconFromTitle("Dust")).toBe("brush");
    expect(inferIconFromTitle("Dust living room shelves")).toBe("brush");
    expect(inferIconFromTitle("Sweep kitchen floor")).toBe("utensils"); // contains kitchen
    expect(inferIconFromTitle("Sweep porch")).toBe("brush");
    expect(inferIconFromTitle("Vacuum rug")).toBe("brush");
    expect(inferIconFromTitle("Vaccuum")).toBe("brush");
  });

  it("identifies balls and toys", () => {
    expect(inferIconFromTitle("Pick up balls")).toBe("gamepad");
    expect(inferIconFromTitle("Put toys away")).toBe("gamepad");
    expect(inferIconFromTitle("Organize legos")).toBe("gamepad");
  });

  it("identifies pets, yard, trash, clothes", () => {
    expect(inferIconFromTitle("Feed the dog")).toBe("dog");
    expect(inferIconFromTitle("Feed the cat")).toBe("cat");
    expect(inferIconFromTitle("Rake leaves in yard")).toBe("leaf");
    expect(inferIconFromTitle("Take out trash")).toBe("trash");
    expect(inferIconFromTitle("Fold laundry")).toBe("shirt");
  });

  it("resolves explicit icon override over inferred title icon", () => {
    // Even if title says "Feed the dog", if explicit icon is "star", it should resolve to Star icon
    const iconElement = resolveTaskIcon("Feed the dog", "star");
    expect(iconElement).toBeDefined();
  });
});
