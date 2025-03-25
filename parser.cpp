#include <iostream>
#include <string>
#include <fstream>

int main(int argc, char* argv[]) {
    if (argc < 4) {
        std::cerr << "Ошибка: Недостаточно аргументов\n";
        std::cerr << "Использование: ./parser [ключевые_слова] [цена] [город]\n";
        return 1;
    }

    std::string keyword = argv[1];
    std::string price = argv[2];
    std::string city = argv[3];

    // Здесь будет парсинг (пока просто пример)
    std::cout << "🔍 Параметры поиска:\n";
    std::cout << "Ключевые слова: " << keyword << "\n";
    std::cout << "Максимальная цена: " << price << " руб\n";
    std::cout << "Город: " << city << "\n";

    // Сохраняем результат в файл (пример)
    std::ofstream outfile("results.txt");
    outfile << "Найдены объявления по запросу: " << keyword << "\n";
    outfile.close();

    return 0;
}