-- meri is Meri.
--
-- Asked by the island's keeper: "Change meri's name to be Meri". The same
-- change `rpc_name_case` makes for an account signed in as Meri: the capitals
-- and nothing else, on the account and on every island it is on. Nothing at
-- all where there is no such account.

update account set display = name_cased(name, 'Meri') where name = 'meri';
update player set name = 'Meri'
 where uid = (select uid from account where name = 'meri') and lower(name) = 'meri';
