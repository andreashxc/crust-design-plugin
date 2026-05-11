export const realtyFeedStyles = `
  .yrfc {
    box-sizing: border-box;
    width: min(100%, 920px);
    margin: 12px auto;
    padding: 14px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px;
    background: #fff;
    color: #111;
    box-shadow: 0 3px 16px rgba(0, 0, 0, 0.06);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  }

  .yrfc,
  .yrfc * {
    box-sizing: border-box;
  }

  .yrfc__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .yrfc__intro {
    min-width: 0;
  }

  .yrfc__kicker {
    margin-bottom: 2px;
    color: #7a7a7a;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
  }

  .yrfc__title {
    margin: 0;
    overflow-wrap: anywhere;
    color: #111;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.15;
  }

  .yrfc__cta {
    flex: 0 0 auto;
    min-height: 34px;
    padding: 8px 12px;
    border-radius: 9px;
    background: #fc0;
    color: #111 !important;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
    text-decoration: none !important;
    white-space: nowrap;
  }

  .yrfc__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .yrfc-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 258px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 12px;
    background: #fff;
    color: #111 !important;
    text-decoration: none !important;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  }

  .yrfc-card:hover {
    transform: translateY(-1px);
    border-color: rgba(0, 0, 0, 0.14);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  }

  .yrfc-card__media {
    position: relative;
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #f4f1eb;
  }

  .yrfc-card__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .yrfc-card__shape {
    position: absolute;
    inset: 16px;
    border-radius: 10px;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.84) 0 16%, transparent 16% 22%, rgba(255, 255, 255, 0.84) 22% 38%, transparent 38% 44%, rgba(255, 255, 255, 0.84) 44% 60%, transparent 60%),
      linear-gradient(180deg, #d7e3ea 0 42%, #b9c8c8 42% 52%, #8eaa9e 52% 100%);
    box-shadow: inset 0 -18px 0 rgba(69, 92, 78, 0.25);
  }

  .yrfc-card__shape--2 {
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.78) 0 18%, transparent 18% 28%, rgba(255, 255, 255, 0.78) 28% 46%, transparent 46% 56%, rgba(255, 255, 255, 0.78) 56% 74%, transparent 74%),
      linear-gradient(180deg, #ead9ca 0 38%, #c5b5a8 38% 55%, #806f65 55% 100%);
  }

  .yrfc-card__shape--3 {
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.82) 0 14%, transparent 14% 26%, rgba(255, 255, 255, 0.82) 26% 40%, transparent 40% 52%, rgba(255, 255, 255, 0.82) 52% 66%, transparent 66%),
      linear-gradient(180deg, #d9e7f0 0 45%, #bec9d0 45% 58%, #7c8b92 58% 100%);
  }

  .yrfc-card__shape--4 {
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.8) 0 20%, transparent 20% 32%, rgba(255, 255, 255, 0.8) 32% 52%, transparent 52% 64%, rgba(255, 255, 255, 0.8) 64% 84%, transparent 84%),
      linear-gradient(180deg, #e3ded4 0 40%, #bdb4a6 40% 56%, #6f7c72 56% 100%);
  }

  .yrfc-card__tag {
    position: absolute;
    top: 8px;
    left: 8px;
    max-width: calc(100% - 16px);
    overflow: hidden;
    padding: 4px 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .yrfc-card__body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    padding: 11px;
  }

  .yrfc-card__price-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 3px 7px;
    margin-bottom: 6px;
  }

  .yrfc-card__price {
    color: #111;
    font-size: 16px;
    font-weight: 800;
    line-height: 1.08;
  }

  .yrfc-card__meter {
    color: #767676;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.1;
  }

  .yrfc-card__title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: #111;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.25;
  }

  .yrfc-card__meta {
    display: -webkit-box;
    overflow: hidden;
    margin-top: 5px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: #666;
    font-size: 12px;
    line-height: 1.25;
  }

  .yrfc-card__footer {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-top: auto;
    padding-top: 9px;
    color: #555;
    font-size: 11px;
    line-height: 1.2;
  }

  .yrfc-card__metro {
    font-weight: 700;
  }

  .yrfc-card__source {
    max-width: 100%;
    overflow: hidden;
    color: #7d7d7d;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .yrfc__annotation {
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #fff8d9;
    color: #5b4a00;
    font-size: 12px;
    line-height: 1.35;
  }

  .yrfc--conservative {
    padding: 12px;
  }

  .yrfc--conservative .yrfc__title {
    font-size: 16px;
  }

  .yrfc--conservative .yrfc__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .yrfc--conservative .yrfc-card {
    min-height: 152px;
    flex-direction: row;
    box-shadow: none;
  }

  .yrfc--conservative .yrfc-card__media {
    flex: 0 0 42%;
    width: auto;
    aspect-ratio: auto;
  }

  .yrfc--conservative .yrfc-card__body {
    padding: 10px;
  }

  .yrfc--conservative .yrfc-card__source {
    display: none;
  }

  .yrfc--exploratory {
    padding: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
  }

  .yrfc--exploratory .yrfc__grid {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }

  .yrfc--exploratory .yrfc-card:first-child {
    grid-row: span 2;
    min-height: 408px;
    flex-direction: column;
  }

  .yrfc--exploratory .yrfc-card:first-child .yrfc-card__media {
    flex-basis: auto;
    min-height: 0;
    aspect-ratio: 16 / 10;
  }

  @media (max-width: 740px) {
    .yrfc {
      width: auto;
      margin: 10px 8px;
      padding: 12px;
      border-radius: 14px;
    }

    .yrfc__header {
      align-items: flex-start;
    }

    .yrfc__title {
      font-size: 17px;
    }

    .yrfc__cta {
      max-width: 44vw;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .yrfc__grid,
    .yrfc--exploratory .yrfc__grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .yrfc--exploratory .yrfc-card:first-child {
      grid-row: auto;
      min-height: 258px;
      flex-direction: column;
    }

    .yrfc--exploratory .yrfc-card:first-child .yrfc-card__media {
      flex-basis: auto;
      min-height: 0;
    }
  }
`;
