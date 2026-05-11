export const realtyFeedStyles = `
  .yrfc-feed-card,
  .yrfc-feed-card * {
    box-sizing: border-box;
  }

  .yrfc-feed-card {
    display: block;
    min-width: 0;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  }

  .yrfc-feed-card__link {
    display: flex;
    overflow: hidden;
    flex-direction: column;
    min-width: 0;
    border-radius: 18px;
    background: #2f2f31;
    color: #fff !important;
    text-decoration: none !important;
    transition: transform 120ms ease, filter 120ms ease;
  }

  .yrfc-feed-card__link:hover {
    transform: translateY(-1px);
    filter: brightness(1.04);
  }

  .yrfc-feed-card__media {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border-radius: 18px 18px 0 0;
    background: #f4f4f4;
  }

  .yrfc-feed-card__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .yrfc-feed-card__placeholder {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(0, 0, 0, 0.08) 100%),
      linear-gradient(90deg, transparent 0 10%, rgba(255, 255, 255, 0.7) 10% 16%, transparent 16% 24%, rgba(255, 255, 255, 0.68) 24% 31%, transparent 31% 39%, rgba(255, 255, 255, 0.68) 39% 47%, transparent 47%),
      linear-gradient(180deg, #dce8ee 0 48%, #aabbb9 48% 63%, #82968c 63% 100%);
  }

  .yrfc-feed-card__placeholder--2 {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.08) 100%),
      linear-gradient(90deg, transparent 0 12%, rgba(255, 255, 255, 0.72) 12% 20%, transparent 20% 31%, rgba(255, 255, 255, 0.7) 31% 39%, transparent 39% 50%, rgba(255, 255, 255, 0.7) 50% 58%, transparent 58%),
      linear-gradient(180deg, #eadccd 0 44%, #c5b2a2 44% 62%, #84766d 62% 100%);
  }

  .yrfc-feed-card__placeholder--3 {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.08) 100%),
      linear-gradient(90deg, transparent 0 14%, rgba(255, 255, 255, 0.72) 14% 21%, transparent 21% 32%, rgba(255, 255, 255, 0.7) 32% 39%, transparent 39% 50%, rgba(255, 255, 255, 0.7) 50% 57%, transparent 57%),
      linear-gradient(180deg, #dce7f0 0 46%, #b5c2c9 46% 62%, #75858e 62% 100%);
  }

  .yrfc-feed-card__placeholder--4 {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.08) 100%),
      linear-gradient(90deg, transparent 0 11%, rgba(255, 255, 255, 0.74) 11% 18%, transparent 18% 29%, rgba(255, 255, 255, 0.7) 29% 36%, transparent 36% 48%, rgba(255, 255, 255, 0.7) 48% 55%, transparent 55%),
      linear-gradient(180deg, #e4dfd6 0 45%, #b9aea0 45% 62%, #748177 62% 100%);
  }

  .yrfc-feed-card__tag {
    position: absolute;
    top: 10px;
    left: 10px;
    max-width: calc(100% - 20px);
    overflow: hidden;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: #222;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .yrfc-feed-card__body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 12px 14px 14px;
  }

  .yrfc-feed-card__title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: #f4f4f4;
    font-size: 14px;
    font-weight: 650;
    line-height: 1.2;
  }

  .yrfc-feed-card__price-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
  }

  .yrfc-feed-card__price {
    color: #fff;
    font-size: 21px;
    font-weight: 850;
    line-height: 1.05;
  }

  .yrfc-feed-card__meter {
    color: rgba(255, 255, 255, 0.76);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.15;
  }

  .yrfc-feed-card__meta,
  .yrfc-feed-card__metro {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    font-weight: 550;
    line-height: 1.25;
  }

  .yrfc-feed-card__metro {
    color: #fff;
    font-weight: 750;
  }

  .yrfc-feed-card__source-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 6px 0;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.2;
  }

  .yrfc-feed-card__service-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #fc0;
    color: #e00000;
    font-size: 18px;
    font-weight: 900;
  }

  .yrfc-feed-card__service {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .yrfc-feed-card__annotation {
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(255, 204, 0, 0.14);
    color: #ffe47a;
    font-size: 12px;
    line-height: 1.3;
  }

  .yrfc-feed-card--conservative .yrfc-feed-card__link {
    border-radius: 16px;
  }

  .yrfc-feed-card--conservative .yrfc-feed-card__media {
    aspect-ratio: 4 / 3;
  }

  .yrfc-feed-card--conservative .yrfc-feed-card__body {
    gap: 5px;
    padding: 10px 12px 12px;
  }

  .yrfc-feed-card--conservative .yrfc-feed-card__title {
    font-size: 13px;
  }

  .yrfc-feed-card--conservative .yrfc-feed-card__price {
    font-size: 18px;
  }

  .yrfc-feed-card--exploratory .yrfc-feed-card__media {
    aspect-ratio: 3 / 4;
  }

  .yrfc-feed-card--exploratory .yrfc-feed-card__title {
    font-size: 15px;
  }

  @media (max-width: 740px) {
    .yrfc-feed-card__source-row {
      font-size: 14px;
    }

    .yrfc-feed-card__price {
      font-size: 18px;
    }
  }
`;
