module.exports = `
  create table status (
    status_name varchar(200) not null,
    enabled boolean not null default false,
    primary key (enabled)
  )
`;
