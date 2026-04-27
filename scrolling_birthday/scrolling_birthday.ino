/*
 * Scrolling Birthday Message on 16x2 LCD
 * Message: "happy birthday engineer KENDIE ❤️"
 *
 * Wiring (standard LiquidCrystal pins):
 *   LCD RS  -> Arduino pin 12
 *   LCD EN  -> Arduino pin 11
 *   LCD D4  -> Arduino pin 5
 *   LCD D5  -> Arduino pin 4
 *   LCD D6  -> Arduino pin 3
 *   LCD D7  -> Arduino pin 2
 *   LCD R/W -> GND
 *   LCD VSS -> GND
 *   LCD VDD -> 5V
 *   LCD V0  -> potentiometer wiper (contrast)
 *   LCD A   -> 5V  (backlight +)
 *   LCD K   -> GND (backlight -)
 */

#include <LiquidCrystal.h>

// Initialize the library with the interface pins
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

// Custom heart character (fills a 5x8 pixel cell)
byte heart[8] = {
  0b00000,
  0b01010,
  0b11111,
  0b11111,
  0b01110,
  0b00100,
  0b00000,
  0b00000
};

// The message to scroll — heart is stored as character code 0
// We build it as a String so the heart custom char (\x00) can be embedded
const char MESSAGE[] = "happy birthday engineer KENDIE \x00";
// Length of the visible part (excluding the null terminator)
const int MSG_LEN = sizeof(MESSAGE) - 1;

// How many columns the LCD has
const int LCD_COLS = 16;
const int LCD_ROWS = 2;

// Scroll delay in milliseconds
const int SCROLL_DELAY = 300;

void setup() {
  lcd.begin(LCD_COLS, LCD_ROWS);
  lcd.createChar(0, heart);   // Register the heart as custom character 0

  // Center a greeting on row 0 while the message scrolls on row 1
  lcd.setCursor(2, 0);
  lcd.print("Happy Birthday!");
}

void loop() {
  // Build a padded version: LCD_COLS spaces + message + LCD_COLS spaces
  // so the text slides fully in from the right and fully out to the left.
  int totalLen = LCD_COLS + MSG_LEN + LCD_COLS;

  for (int pos = 0; pos < totalLen - LCD_COLS + 1; pos++) {
    lcd.setCursor(0, 1);

    for (int col = 0; col < LCD_COLS; col++) {
      int idx = pos + col - LCD_COLS; // index into the message (negative = leading space)
      if (idx < 0 || idx >= MSG_LEN) {
        lcd.print(' ');
      } else {
        // Use write() so the custom char (code 0) is printed correctly
        lcd.write((uint8_t)MESSAGE[idx]);
      }
    }

    delay(SCROLL_DELAY);
  }
}
