module.exports = `
  create table status (
    enabled boolean not null default false,
    primary key (enabled)
  )
`;
