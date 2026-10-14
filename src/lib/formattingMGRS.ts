export const formattingMGRS = {
  spacing: (str: string) => {
    if (!str || str.trim() === "" || str.includes(" ")) return str;
    const first = str.slice(0, 3);
    const second = str.slice(3, 5);
    const third = str.slice(5);
    const divider = third.length / 2;
    return `${first} ${second} ${third.slice(0, divider)} ${third.slice(divider)}`;
  },
};
