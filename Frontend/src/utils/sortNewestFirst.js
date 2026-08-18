const getTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortNewestFirst = (items, dateField) => (
  [...items].sort((left, right) => (
    getTimestamp(right?.[dateField]) - getTimestamp(left?.[dateField])
    || getTimestamp(right?.createdAt) - getTimestamp(left?.createdAt)
  ))
);

export default sortNewestFirst;
