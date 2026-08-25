import { BrandStory, PartnerBrand } from "../types";

export const brandStories: BrandStory[] = [
  {
    id: "story_starbucks",
    brandId: "starbucks",
    name: "Starbucks",
    logo: "https://images.unsplash.com/photo-1561040772-7970493097fe?auto=format&fit=crop&w=100&q=80",
    category: "Cafe",
    timeAgo: "2h",
    stepsPrice: 3500,
    shortDesc: "Walk in for a Grande on us.",
    fullDesc: "Redeem steps for a Grande beverage at participating Starbucks.",
    frames: [
      {
        id: "sb1",
        image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
        caption: "Morning pour. 3,500 steps = a Grande on us.",
      },
      {
        id: "sb2",
        image: "https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=900&q=80",
        caption: "Caramel Macchiato happy hour starts now.",
      },
      {
        id: "sb3",
        image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
        caption: "Pair it with a free morning pastry.",
      },
    ],
  },
  {
    id: "story_bloom",
    brandId: "bloom_cafe",
    name: "Bloom Cafe",
    logo: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=100&q=80",
    category: "Cafe",
    timeAgo: "4h",
    stepsPrice: 2800,
    shortDesc: "Neighborhood pour-over and pastry.",
    fullDesc: "Trade steps for a pour-over and seasonal pastry at Bloom.",
    frames: [
      {
        id: "bl1",
        image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
        caption: "Single-origin pour-over just dropped.",
      },
      {
        id: "bl2",
        image: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=900&q=80",
        caption: "Sourdough + honey butter after your walk.",
      },
    ],
  },
  {
    id: "story_grind",
    brandId: "daily_grind",
    name: "Daily Grind",
    logo: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=100&q=80",
    category: "Cafe",
    timeAgo: "6h",
    stepsPrice: 2200,
    shortDesc: "Espresso reward for early walkers.",
    fullDesc: "Free double espresso when you hit 2,200 steps before noon.",
    frames: [
      {
        id: "dg1",
        image: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80",
        caption: "Double shot for the 7am club.",
      },
      {
        id: "dg2",
        image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80",
        caption: "Walk 2,200 steps. Espresso is on us.",
      },
    ],
  },
  {
    id: "story_mcdonalds",
    brandId: "mcdonalds",
    name: "McDonald's",
    logo: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=100&q=80",
    category: "Food",
    timeAgo: "8h",
    stepsPrice: 5000,
    shortDesc: "Post-run Big Mac reward.",
    fullDesc: "Redeem 5,000 steps for a Big Mac after your session.",
    frames: [
      {
        id: "md1",
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
        caption: "Finish the run. Claim the Big Mac.",
      },
      {
        id: "md2",
        image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=80",
        caption: "5,000 steps unlocks today's cheat meal.",
      },
    ],
  },
  {
    id: "story_nike",
    brandId: "nike",
    name: "Nike Store",
    logo: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=100&q=80",
    category: "Apparel",
    timeAgo: "12h",
    stepsPrice: 12000,
    shortDesc: "20% off Pegasus this week.",
    fullDesc: "Member-only 20% off selected Nike running shoes.",
    frames: [
      {
        id: "nk1",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
        caption: "Pegasus restock. Walkers get first look.",
      },
      {
        id: "nk2",
        image: "https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80",
        caption: "12,000 steps = 20% off in-store.",
      },
    ],
  },
  {
    id: "story_gymshark",
    brandId: "gymshark",
    name: "Gymshark",
    logo: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=100&q=80",
    category: "Fitness",
    timeAgo: "1d",
    stepsPrice: 15000,
    shortDesc: "Premium HQ day pass.",
    fullDesc: "Unlock a Gymshark wellness HQ day pass with steps.",
    frames: [
      {
        id: "gs1",
        image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
        caption: "Cold plunge + weights. Pass drops today.",
      },
      {
        id: "gs2",
        image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80",
        caption: "15,000 steps unlocks a day at HQ.",
      },
    ],
  },
];

export function brandFromStory(story: BrandStory): PartnerBrand {
  return {
    id: story.brandId,
    name: story.name,
    logo: story.logo,
    category: story.category,
    coverImage: story.frames[0]?.image || story.logo,
    stepsPrice: story.stepsPrice,
    shortDesc: story.shortDesc,
    fullDesc: story.fullDesc,
    expiresInDays: 5,
    progressPercent: 45,
  };
}
