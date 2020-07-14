1.9.0: Fixed compile everytime problem and submit directly from windows.
1.8.0: Deal with possible empty compilecmd property, need get more on the 
1.7.0: Stop the possible RTE debugging invoking action.
1.6.0: Create system snippet file and directory if it is not there. add ctrl+alt+k 4  as the key for show the system config file. also as create such file if it's not there.
Also update cp directory for a package.json copy 
The copy solution does require user have some initial json file to work with.
Always do showsnippet sys, then extract.

1.5.0: Enable unified path in both windows and linux

1.4.0: Copy the system config into the cp/config/snippets  directory.
       Also change the snipet extraction directory into the same folder for git purpose
       when set up  dirsnippets, never ends with seperators

       also if you want to change the name of script, just go to dirsnippets directory , delete the system one and regenerate.