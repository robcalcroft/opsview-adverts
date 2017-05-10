module.exports = `
  create table adverts (
    name varchar(100) not null,
    target_size varchar(10) not null,
    created datetime not null default(strftime('%s','now')),
    redirect_url varchar(500) not null,
    image_name varchar(200) not null,
    primary key (name, image_name)
  )
`;
