import React from "react";
import {
  type LucideIcon,
  AlarmClock,
  Apple,
  Baby,
  Backpack,
  Bath,
  Bed,
  Bike,
  Bird,
  BookOpen,
  Brush,
  Car,
  Cat,
  ChefHat,
  Clock,
  Coins,
  Cookie,
  Dog,
  DoorClosed,
  Droplets,
  Dumbbell,
  Fish,
  Flower2,
  Footprints,
  Gamepad2,
  GlassWater,
  Hammer,
  Heart,
  Home,
  Laptop,
  Leaf,
  Lightbulb,
  ListChecks,
  Mail,
  Moon,
  Music,
  Package,
  Palette,
  Pencil,
  PiggyBank,
  Pill,
  Rabbit,
  Recycle,
  Scissors,
  Shirt,
  ShoppingBag,
  ShowerHead,
  Shovel,
  Smile,
  Sparkles,
  SprayCan,
  Sprout,
  Star,
  Sun,
  Sunrise,
  Trash2,
  Trophy,
  Tv,
  Utensils,
  WashingMachine,
  Wrench
} from "lucide-react";

export type ChoreIconDef = {
  id: string;
  label: string;
  Icon: LucideIcon;
  category?: string;
  keywords?: string[];
};

export const CHORE_ICONS: ChoreIconDef[] = [
  // 1. Cleaning & Chores
  { id: "sparkles", label: "Clean / Tidy", Icon: Sparkles, category: "cleaning", keywords: ["clean", "tidy", "organize", "reset", "room", "shine"] },
  { id: "brush", label: "Dust & Sweep", Icon: Brush, category: "cleaning", keywords: ["sweep", "dust", "broom", "vacuum", "mop", "wipe", "floor"] },
  { id: "spray-can", label: "Spray & Wipe", Icon: SprayCan, category: "cleaning", keywords: ["spray", "disinfect", "sanitize", "counter", "wipe", "table", "cleaner"] },
  { id: "trash", label: "Trash & Waste", Icon: Trash2, category: "cleaning", keywords: ["trash", "garbage", "rubbish", "bin", "can", "dump", "empty"] },
  { id: "recycle", label: "Recycling & Sort", Icon: Recycle, category: "cleaning", keywords: ["recycle", "recycling", "sort", "compost", "cardboard", "plastic", "green bin", "blue bin"] },
  { id: "package", label: "Packages & Boxes", Icon: Package, category: "cleaning", keywords: ["package", "boxes", "box", "delivery", "mail", "unpack", "break down", "storage"] },

  // 2. Kitchen & Food
  { id: "utensils", label: "Dishes / Kitchen", Icon: Utensils, category: "kitchen", keywords: ["dishes", "dish", "dishwasher", "plates", "fork", "spoon", "silverware", "kitchen", "dinner", "lunch", "breakfast"] },
  { id: "chef-hat", label: "Cooking & Meal Prep", Icon: ChefHat, category: "kitchen", keywords: ["cook", "cooking", "chef", "bake", "recipe", "meal", "dinner", "prepare", "help cook"] },
  { id: "apple", label: "Snack & Lunchbox", Icon: Apple, category: "kitchen", keywords: ["snack", "apple", "fruit", "lunchbox", "pack lunch", "healthy", "food"] },
  { id: "cookie", label: "Baking & Treats", Icon: Cookie, category: "kitchen", keywords: ["cookie", "cookies", "bake", "baking", "treat", "dessert", "snack"] },
  { id: "glass-water", label: "Cups & Drinks", Icon: GlassWater, category: "kitchen", keywords: ["cup", "cups", "water", "glass", "drink", "refill", "juice"] },

  // 3. Laundry & Clothes
  { id: "washing-machine", label: "Washer & Dryer", Icon: WashingMachine, category: "laundry", keywords: ["washer", "dryer", "washing", "laundry", "load", "clothes", "machine"] },
  { id: "shirt", label: "Laundry & Clothes", Icon: Shirt, category: "laundry", keywords: ["laundry", "clothes", "fold", "hang", "shirt", "pants", "dress", "socks", "wardrobe", "drawer"] },
  { id: "footprints", label: "Shoes & Boots", Icon: Footprints, category: "laundry", keywords: ["shoes", "boots", "sneakers", "walk", "hallway", "put away shoes", "closet"] },

  // 4. Bedroom & Bathroom
  { id: "bed", label: "Make Bed", Icon: Bed, category: "bathroom", keywords: ["bed", "sheets", "pillow", "blanket", "make bed", "bedroom", "sheets"] },
  { id: "bath", label: "Bath & Shower", Icon: Bath, category: "bathroom", keywords: ["bath", "bathtub", "wash hands", "tub", "soap"] },
  { id: "shower-head", label: "Shower", Icon: ShowerHead, category: "bathroom", keywords: ["shower", "wash hair", "rinse", "bathroom"] },
  { id: "smile", label: "Brush Teeth", Icon: Smile, category: "bathroom", keywords: ["teeth", "brush teeth", "floss", "mouthwash", "smile", "hygiene"] },

  // 5. Yard & Outdoors
  { id: "leaf", label: "Yard & Garden", Icon: Leaf, category: "yard", keywords: ["yard", "leaf", "leaves", "rake", "lawn", "mow", "outdoor", "grass"] },
  { id: "sprout", label: "Water Plants", Icon: Sprout, category: "yard", keywords: ["plants", "plant", "water plants", "seedling", "garden", "grow", "weed", "soil"] },
  { id: "flower", label: "Flowers & Garden", Icon: Flower2, category: "yard", keywords: ["flower", "flowers", "bloom", "garden", "petals", "water flowers"] },
  { id: "shovel", label: "Shovel, Snow & Dirt", Icon: Shovel, category: "yard", keywords: ["shovel", "snow", "dirt", "dig", "driveway", "sidewalk", "ice", "winter"] },
  { id: "car", label: "Car & Garage", Icon: Car, category: "yard", keywords: ["car", "vehicle", "wash car", "garage", "van", "truck"] },
  { id: "bike", label: "Bike / Outdoors", Icon: Bike, category: "yard", keywords: ["bike", "bicycle", "scooter", "ride", "helmet", "outdoors", "park"] },
  { id: "sun", label: "Sunscreen & Outside", Icon: Sun, category: "yard", keywords: ["sun", "sunscreen", "sunny", "outside", "sunglasses", "play outside"] },

  // 6. Pets & Animals
  { id: "dog", label: "Dog / Walk", Icon: Dog, category: "pets", keywords: ["dog", "puppy", "walk dog", "feed dog", "leash", "pet"] },
  { id: "cat", label: "Cat / Pet Care", Icon: Cat, category: "pets", keywords: ["cat", "kitten", "litter", "feed cat", "litter box", "pet"] },
  { id: "fish", label: "Fish / Pets", Icon: Fish, category: "pets", keywords: ["fish", "aquarium", "tank", "feed fish", "bowl"] },
  { id: "bird", label: "Birds & Chickens", Icon: Bird, category: "pets", keywords: ["bird", "birds", "chicken", "chickens", "coop", "eggs", "bird feeder", "feed birds"] },
  { id: "rabbit", label: "Small Pets", Icon: Rabbit, category: "pets", keywords: ["rabbit", "bunny", "hamster", "guinea pig", "cage", "small pets"] },

  // 7. School, Arts & Learning
  { id: "backpack", label: "Backpack & School Prep", Icon: Backpack, category: "school", keywords: ["backpack", "pack bag", "school bag", "school prep", "supplies", "pack"] },
  { id: "book", label: "Read / School", Icon: BookOpen, category: "school", keywords: ["book", "read", "reading", "library", "chapter", "story", "school"] },
  { id: "pencil", label: "Homework / Study", Icon: Pencil, category: "school", keywords: ["homework", "study", "pencil", "write", "math", "worksheet", "school"] },
  { id: "palette", label: "Art & Crafts", Icon: Palette, category: "school", keywords: ["art", "crafts", "paint", "painting", "draw", "drawing", "coloring", "clean art"] },
  { id: "scissors", label: "Crafts & Projects", Icon: Scissors, category: "school", keywords: ["scissors", "craft", "cut", "project", "paper", "glue"] },
  { id: "music", label: "Music Practice", Icon: Music, category: "school", keywords: ["music", "piano", "guitar", "instrument", "violin", "practice", "song"] },

  // 8. Routines & Health
  { id: "sunrise", label: "Morning", Icon: Sunrise, category: "routines", keywords: ["morning", "wake", "rise", "start day", "breakfast"] },
  { id: "moon", label: "Bedtime / Night", Icon: Moon, category: "routines", keywords: ["night", "bedtime", "sleep", "evening", "lights out"] },
  { id: "alarm-clock", label: "Alarm & Wake Up", Icon: AlarmClock, category: "routines", keywords: ["alarm", "wake up", "timer", "clock", "early"] },
  { id: "clock", label: "Time & Routines", Icon: Clock, category: "routines", keywords: ["time", "clock", "timer", "schedule", "routine", "minutes"] },
  { id: "droplets", label: "Water Bottles & Hydrate", Icon: Droplets, category: "routines", keywords: ["water", "bottle", "hydrate", "water bottles", "refill", "drink"] },
  { id: "pill", label: "Vitamins & Medicine", Icon: Pill, category: "routines", keywords: ["vitamin", "vitamins", "medicine", "pill", "pills", "health", "supplement", "meds"] },
  { id: "baby", label: "Baby & Sibling Care", Icon: Baby, category: "routines", keywords: ["baby", "sibling", "toddler", "diaper", "brother", "sister", "help baby"] },
  { id: "dumbbell", label: "Sports & Exercise", Icon: Dumbbell, category: "routines", keywords: ["sport", "sports", "exercise", "workout", "gym", "soccer", "practice", "fit"] },

  // 9. Household & Maintenance
  { id: "home", label: "House & Room", Icon: Home, category: "home", keywords: ["house", "home", "room", "living room", "hallway", "basement"] },
  { id: "shopping-bag", label: "Groceries & Errands", Icon: ShoppingBag, category: "home", keywords: ["groceries", "grocery", "shopping", "store", "market", "errand", "unpack groceries"] },
  { id: "mail", label: "Mail & Mailbox", Icon: Mail, category: "home", keywords: ["mail", "mailbox", "letter", "letters", "post", "check mail"] },
  { id: "lightbulb", label: "Turn Off Lights", Icon: Lightbulb, category: "home", keywords: ["light", "lights", "turn off lights", "lamp", "energy", "switch"] },
  { id: "door-closed", label: "Lock Doors & Windows", Icon: DoorClosed, category: "home", keywords: ["door", "doors", "lock", "windows", "close doors", "security", "shut"] },
  { id: "hammer", label: "Fix & Build", Icon: Hammer, category: "home", keywords: ["hammer", "fix", "build", "tool", "repair", "garage", "workbench"] },
  { id: "wrench", label: "Tools & Maintenance", Icon: Wrench, category: "home", keywords: ["wrench", "tool", "tools", "tighten", "maintenance", "fix"] },

  // 10. Play, Goals & Rewards
  { id: "gamepad", label: "Toys / Play", Icon: Gamepad2, category: "goals", keywords: ["toys", "play", "game", "games", "lego", "balls", "put away toys"] },
  { id: "tv", label: "TV & Screen Off", Icon: Tv, category: "goals", keywords: ["tv", "television", "screen", "screens off", "shows", "remote"] },
  { id: "laptop", label: "Devices & Computer", Icon: Laptop, category: "goals", keywords: ["laptop", "computer", "ipad", "tablet", "device", "screen time"] },
  { id: "star", label: "Special Goal", Icon: Star, category: "goals", keywords: ["star", "goal", "special", "reward", "favorite", "milestone"] },
  { id: "trophy", label: "Reward & Achievement", Icon: Trophy, category: "goals", keywords: ["trophy", "reward", "win", "winner", "achievement", "champion", "prize"] },
  { id: "piggy-bank", label: "Allowance & Savings", Icon: PiggyBank, category: "goals", keywords: ["allowance", "money", "piggy bank", "save", "savings", "bank", "coins"] },
  { id: "coins", label: "Earn Money & Coins", Icon: Coins, category: "goals", keywords: ["coins", "money", "cash", "earn", "pay", "cents", "dollar"] },
  { id: "heart", label: "Help & Care", Icon: Heart, category: "goals", keywords: ["heart", "help", "care", "kindness", "love", "family", "hug"] },
  { id: "list", label: "Checklist", Icon: ListChecks, category: "goals", keywords: ["list", "check", "checklist", "todo", "task", "chores"] },
];

export const CHORE_ICON_MAP = new Map<string, LucideIcon>(
  CHORE_ICONS.map((item) => [item.id, item.Icon])
);

export function inferIconFromTitle(title: string): string {
  const t = title.toLowerCase();

  // 1. Specific baking & cooking treats
  if (t.includes("cookie") || t.includes("bake") || t.includes("baking") || t.includes("muffin")) {
    return "cookie";
  }

  // 2. Kitchen & Dishes first (prevents "dishwasher" from matching "wash" -> Bath)
  if (
    t.includes("dish") ||
    t.includes("plate") ||
    t.includes("cup") ||
    t.includes("fork") ||
    t.includes("silverware") ||
    t.includes("kitchen") ||
    t.includes("dinner") ||
    t.includes("lunch") ||
    t.includes("breakfast") ||
    t.includes("snack") ||
    t.includes("cook") ||
    t.includes("eat") ||
    t.includes("table")
  ) {
    return "utensils";
  }

  // 3. Spray & sanitizing vs Dusting/sweeping/vacuuming
  if (t.includes("spray") || t.includes("disinfect") || t.includes("sanitize")) {
    return "spray-can";
  }

  if (
    t.includes("dust") ||
    t.includes("sweep") ||
    t.includes("mop") ||
    t.includes("vacuum") ||
    t.includes("vaccu") ||
    t.includes("broom") ||
    t.includes("wipe")
  ) {
    return "brush";
  }

  // 4. Recycling specifically before trash
  if (t.includes("recycle") || t.includes("recycling") || t.includes("compost")) {
    return "recycle";
  }

  // 5. Groceries, Mail & Delivery Packages
  if (t.includes("grocer") || t.includes("supermarket") || t.includes("shopping")) {
    return "shopping-bag";
  }
  if (t.includes("mail") || t.includes("mailbox") || t.includes("letter") || t.includes("post office")) {
    return "mail";
  }
  if (t.includes("package") || t.includes("parcel") || t.includes("delivery") || t.includes("box") || t.includes("boxes")) {
    return "package";
  }

  // 6. Toys, games, electronics
  if (
    t.includes("ball") ||
    t.includes("balls") ||
    t.includes("toy") ||
    t.includes("toys") ||
    t.includes("lego") ||
    t.includes("game")
  ) {
    return "gamepad";
  }
  if (t.includes("tv") || t.includes("television") || t.includes("watch show")) {
    return "tv";
  }
  if (t.includes("computer") || t.includes("laptop") || t.includes("tablet") || t.includes("ipad") || t.includes("screen time")) {
    return "laptop";
  }

  // 7. Teeth & Hygiene
  if (t.includes("teeth") || t.includes("floss") || t.includes("mouthwash")) {
    return "smile";
  }

  // 8. Washer & Dryer / Shoes / Laundry & Clothes
  if (t.includes("washer") || t.includes("dryer")) {
    return "washing-machine";
  }
  if (t.includes("shoe") || t.includes("shoes") || t.includes("boot") || t.includes("boots") || t.includes("sneaker")) {
    return "footprints";
  }
  if (
    t.includes("dress") ||
    t.includes("clothes") ||
    t.includes("shirt") ||
    t.includes("pajama") ||
    t.includes("outfit") ||
    t.includes("jacket") ||
    t.includes("laundry") ||
    t.includes("fold") ||
    t.includes("sock")
  ) {
    return "shirt";
  }

  // 9. Bed & Making Bed (excluding bedroom or bedtime)
  if (
    t.includes("make bed") ||
    t.includes("sheets") ||
    t.includes("pillow") ||
    t.includes("blanket") ||
    (t.includes("bed") && !t.includes("bedroom") && !t.includes("bedtime"))
  ) {
    return "bed";
  }

  // 10. Bath & Shower & Washing hands (now safe from "dishwasher")
  if (
    t.includes("bath") ||
    t.includes("shower") ||
    t.includes("soap") ||
    t.includes("wash") ||
    t.includes("hands")
  ) {
    return "bath";
  }

  // 11. School backpack & supplies
  if (t.includes("backpack") || t.includes("school bag") || t.includes("pack bag")) {
    return "backpack";
  }

  // 12. Homework, Reading, School, Arts & Crafts
  if (t.includes("paint") || t.includes("draw") || t.includes("coloring") || /\bart\b/.test(t) || t.includes("craft")) {
    return "palette";
  }
  if (t.includes("scissor")) {
    return "scissors";
  }
  if (
    t.includes("book") ||
    t.includes("read") ||
    t.includes("library") ||
    t.includes("homework") ||
    t.includes("school") ||
    t.includes("study")
  ) {
    return "book";
  }

  // 13. Plants & Flowers before generic yard
  if (t.includes("flower")) {
    return "flower";
  }
  if (t.includes("plant") || t.includes("sprout") || t.includes("seedling")) {
    return "sprout";
  }
  if (t.includes("shovel") || t.includes("snow") || /\bice\b/.test(t)) {
    return "shovel";
  }
  if (t.includes("sunscreen") || t.includes("sunglass")) {
    return "sun";
  }

  // 14. Yard & Yard work
  if (
    t.includes("garden") ||
    t.includes("yard") ||
    t.includes("rake") ||
    t.includes("leaf") ||
    t.includes("leaves") ||
    t.includes("lawn") ||
    t.includes("outdoor")
  ) {
    return "leaf";
  }

  // 15. Car & Vehicle
  if (t.includes("car") || t.includes("vehicle") || t.includes("garage")) {
    return "car";
  }
  if (t.includes("bike") || t.includes("bicycle") || t.includes("scooter")) {
    return "bike";
  }

  // 16. Trash & Waste
  if (
    t.includes("trash") ||
    t.includes("garbage") ||
    /\bbins?\b/.test(t)
  ) {
    return "trash";
  }

  // 17. Pets & Animals
  if (t.includes("dog") || t.includes("puppy") || t.includes("walk dog") || t.includes("walk the dog") || t.includes("walk")) return "dog";
  if (t.includes("cat") || t.includes("kitten")) return "cat";
  if (t.includes("fish") || t.includes("aquarium")) return "fish";
  if (t.includes("bird") || t.includes("chicken") || t.includes("coop")) return "bird";
  if (t.includes("rabbit") || t.includes("bunny") || t.includes("hamster")) return "rabbit";
  if (/\bpets?\b/.test(t)) return "dog";

  // 18. Health, Vitamins & Medicine / Hydration / Sports
  if (t.includes("vitamin") || t.includes("medicine") || t.includes("pill") || t.includes("meds")) {
    return "pill";
  }
  if (t.includes("water bottle") || t.includes("hydrate")) {
    return "droplets";
  }
  if (t.includes("baby") || t.includes("diaper") || t.includes("sibling")) {
    return "baby";
  }
  if (t.includes("sport") || t.includes("exercise") || t.includes("workout") || t.includes("gym") || t.includes("soccer") || t.includes("basketball") || t.includes("practice")) {
    return "dumbbell";
  }

  // 19. Home & Security
  if (t.includes("light") || t.includes("lamp")) return "lightbulb";
  if (
    t.includes("front door") ||
    t.includes("back door") ||
    t.includes("lock door") ||
    t.includes("lock doors") ||
    (t.includes("door") && (t.includes("lock") || t.includes("shut") || t.includes("close"))) ||
    (t.includes("window") && (t.includes("lock") || t.includes("shut") || t.includes("close")))
  ) {
    return "door-closed";
  }
  if (t.includes("tool") || t.includes("wrench")) return "wrench";

  // 20. Music & Instruments
  if (t.includes("piano") || t.includes("guitar") || t.includes("music") || t.includes("instrument")) {
    return "music";
  }

  // 21. Money, Allowance & Goals
  if (t.includes("allowance") || t.includes("piggy bank") || t.includes("save money")) return "piggy-bank";
  if (t.includes("coin") || t.includes("cash") || t.includes("earn")) return "coins";
  if (t.includes("trophy") || t.includes("reward") || t.includes("champion") || t.includes("win")) return "trophy";
  if (t.includes("goal")) return "star";
  if (t.includes("kindness") || t.includes("hug") || t.includes("help")) return "heart";

  // 22. Routines: Morning / Night / Alarm / Time
  if (t.includes("alarm") || t.includes("timer")) return "alarm-clock";
  if (t.includes("clock") || t.includes("schedule")) return "clock";
  if (t.includes("morning") || t.includes("wake") || t.includes("rise")) return "sunrise";
  if (t.includes("night") || t.includes("sleep") || t.includes("evening") || t.includes("bedtime")) return "moon";

  // 23. Cleaning / Tidying
  if (
    t.includes("clean") ||
    t.includes("tidy") ||
    t.includes("room") ||
    t.includes("reset")
  ) {
    return "sparkles";
  }

  return "list";
}

export function resolveTaskIcon(
  title: string,
  iconKey?: string | null,
  size = 19
): React.ReactElement {
  const normalizedKey = iconKey?.toLowerCase().trim();
  const IconComponent: LucideIcon = (normalizedKey ? CHORE_ICON_MAP.get(normalizedKey) : undefined)
    ?? CHORE_ICON_MAP.get(inferIconFromTitle(title))
    ?? ListChecks;

  return <IconComponent size={size} aria-hidden="true" />;
}

export function getIconComponent(iconKey: string): LucideIcon {
  return CHORE_ICON_MAP.get(iconKey) ?? ListChecks;
}
