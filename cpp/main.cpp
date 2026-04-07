#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <map>
#include <string>
#include <algorithm>
#include <iomanip>
#include <ctime>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

// ─── Expense Class ────────────────────────────────────────────────────────────
class Expense {
private:
    std::string id;
    std::string date;       // DD-MM-YYYY
    std::string category;
    double amount;
    std::string note;
    std::string month;      // MM-YYYY derived

public:
    // Valid categories
    static const std::vector<std::string> VALID_CATEGORIES;

    Expense() : amount(0.0) {}

    Expense(const std::string& id, const std::string& date,
            const std::string& category, double amount,
            const std::string& note)
        : id(id), date(date), category(category), amount(amount), note(note) {
        // Derive month from date (DD-MM-YYYY)
        if (date.size() >= 7) {
            month = date.substr(3, 7); // MM-YYYY
        }
    }

    // Getters
    std::string getId()       const { return id; }
    std::string getDate()     const { return date; }
    std::string getCategory() const { return category; }
    double      getAmount()   const { return amount; }
    std::string getNote()     const { return note; }
    std::string getMonth()    const { return month; }

    // Setters
    void setAmount(double a)          { amount = a; }
    void setNote(const std::string& n){ note = n; }
    void setCategory(const std::string& c){ category = c; }

    // Serialize to CSV line
    std::string toCSV() const {
        return id + "," + date + "," + category + ","
               + std::to_string(amount) + "," + note;
    }

    // Deserialize from CSV line
    static Expense fromCSV(const std::string& line) {
        std::istringstream ss(line);
        std::string id, date, category, amtStr, note;
        std::getline(ss, id,       ',');
        std::getline(ss, date,     ',');
        std::getline(ss, category, ',');
        std::getline(ss, amtStr,   ',');
        std::getline(ss, note);
        double amt = 0.0;
        try { amt = std::stod(amtStr); } catch (...) {}
        return Expense(id, date, category, amt, note);
    }

    // Serialize to JSON
    std::string toJSON() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        oss << "{\"id\":\"" << id << "\""
            << ",\"date\":\"" << date << "\""
            << ",\"category\":\"" << category << "\""
            << ",\"amount\":" << amount
            << ",\"note\":\"" << note << "\""
            << ",\"month\":\"" << month << "\"}";
        return oss.str();
    }

    // Validate category
    static bool isValidCategory(const std::string& cat) {
        return std::find(VALID_CATEGORIES.begin(), VALID_CATEGORIES.end(), cat)
               != VALID_CATEGORIES.end();
    }
};

const std::vector<std::string> Expense::VALID_CATEGORIES = {
    "Food", "Transport", "Shopping", "Entertainment",
    "Health", "Bills", "Education", "Travel", "Other"
};

// ─── BudgetManager Class ──────────────────────────────────────────────────────
class BudgetManager {
private:
    std::vector<Expense> expenses;
    std::map<std::string, double> monthlyBudgets; // month -> budget
    std::string dataFile;
    std::string budgetFile;
    int nextId;

    std::string generateId() {
        return "EXP" + std::to_string(nextId++);
    }

    void loadNextId() {
        nextId = 1;
        for (const auto& e : expenses) {
            std::string id = e.getId();
            if (id.size() > 3) {
                try {
                    int n = std::stoi(id.substr(3));
                    if (n >= nextId) nextId = n + 1;
                } catch (...) {}
            }
        }
    }

public:
    BudgetManager(const std::string& df = "expenses.csv",
                  const std::string& bf = "budgets.csv")
        : dataFile(df), budgetFile(bf), nextId(1) {
        loadExpenses();
        loadBudgets();
        loadNextId();
    }

    // ── File I/O ──────────────────────────────────────────────────────────────
    void loadExpenses() {
        expenses.clear();
        std::ifstream file(dataFile);
        if (!file.is_open()) return;
        std::string line;
        while (std::getline(file, line)) {
            if (!line.empty()) {
                expenses.push_back(Expense::fromCSV(line));
            }
        }
    }

    void saveExpenses() const {
        std::ofstream file(dataFile, std::ios::trunc);
        for (const auto& e : expenses) {
            file << e.toCSV() << "\n";
        }
    }

    void loadBudgets() {
        monthlyBudgets.clear();
        std::ifstream file(budgetFile);
        if (!file.is_open()) return;
        std::string line;
        while (std::getline(file, line)) {
            std::istringstream ss(line);
            std::string month, amtStr;
            std::getline(ss, month,  ',');
            std::getline(ss, amtStr, ',');
            if (!month.empty() && !amtStr.empty()) {
                try {
                    monthlyBudgets[month] = std::stod(amtStr);
                } catch (...) {}
            }
        }
    }

    void saveBudgets() const {
        std::ofstream file(budgetFile, std::ios::trunc);
        for (const auto& kv : monthlyBudgets) {
            file << kv.first << "," << kv.second << "\n";
        }
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────
    std::string addExpense(const std::string& date, const std::string& category,
                           double amount, const std::string& note) {
        if (amount <= 0) return "{\"success\":false,\"error\":\"Amount must be positive\"}";
        if (!Expense::isValidCategory(category))
            return "{\"success\":false,\"error\":\"Invalid category\"}";
        if (date.size() < 10)
            return "{\"success\":false,\"error\":\"Invalid date format DD-MM-YYYY\"}";

        std::string id = generateId();
        expenses.emplace_back(id, date, category, amount, note);
        saveExpenses();
        return "{\"success\":true,\"id\":\"" + id + "\"}";
    }

    std::string deleteExpense(const std::string& id) {
        auto it = std::find_if(expenses.begin(), expenses.end(),
                               [&](const Expense& e){ return e.getId() == id; });
        if (it == expenses.end())
            return "{\"success\":false,\"error\":\"Not found\"}";
        expenses.erase(it);
        saveExpenses();
        return "{\"success\":true}";
    }

    std::string editExpense(const std::string& id, const std::string& date,
                            const std::string& category, double amount,
                            const std::string& note) {
        for (auto& e : expenses) {
            if (e.getId() == id) {
                if (amount <= 0) return "{\"success\":false,\"error\":\"Amount must be positive\"}";
                if (!Expense::isValidCategory(category))
                    return "{\"success\":false,\"error\":\"Invalid category\"}";
                e = Expense(id, date, category, amount, note);
                saveExpenses();
                return "{\"success\":true}";
            }
        }
        return "{\"success\":false,\"error\":\"Not found\"}";
    }

    // ── Queries ───────────────────────────────────────────────────────────────
    std::string getAllExpenses() const {
        std::string json = "[";
        for (size_t i = 0; i < expenses.size(); i++) {
            if (i > 0) json += ",";
            json += expenses[i].toJSON();
        }
        return json + "]";
    }

    std::string getExpensesByCategory(const std::string& category) const {
        std::string json = "[";
        bool first = true;
        for (const auto& e : expenses) {
            if (e.getCategory() == category) {
                if (!first) json += ",";
                json += e.toJSON();
                first = false;
            }
        }
        return json + "]";
    }

    std::string getExpensesByMonth(const std::string& month) const {
        std::string json = "[";
        bool first = true;
        for (const auto& e : expenses) {
            if (e.getMonth() == month) {
                if (!first) json += ",";
                json += e.toJSON();
                first = false;
            }
        }
        return json + "]";
    }

    // ── Reports ───────────────────────────────────────────────────────────────
    std::string getMonthlyTotal(const std::string& month) const {
        double total = 0.0;
        for (const auto& e : expenses) {
            if (e.getMonth() == month) total += e.getAmount();
        }
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        oss << "{\"month\":\"" << month << "\",\"total\":" << total;

        auto budgetIt = monthlyBudgets.find(month);
        if (budgetIt != monthlyBudgets.end()) {
            double budget = budgetIt->second;
            double remaining = budget - total;
            bool exceeded = total > budget;
            oss << ",\"budget\":" << budget
                << ",\"remaining\":" << remaining
                << ",\"exceeded\":" << (exceeded ? "true" : "false")
                << ",\"percentage\":" << (budget > 0 ? (total/budget*100.0) : 0.0);
        } else {
            oss << ",\"budget\":0,\"remaining\":0,\"exceeded\":false,\"percentage\":0";
        }
        oss << "}";
        return oss.str();
    }

    std::string getCategoryTotals(const std::string& month) const {
        std::map<std::string, double> totals;
        for (const auto& cat : Expense::VALID_CATEGORIES) totals[cat] = 0.0;
        for (const auto& e : expenses) {
            if (month.empty() || e.getMonth() == month) {
                totals[e.getCategory()] += e.getAmount();
            }
        }
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        oss << "{";
        bool first = true;
        for (const auto& kv : totals) {
            if (!first) oss << ",";
            oss << "\"" << kv.first << "\":" << kv.second;
            first = false;
        }
        oss << "}";
        return oss.str();
    }

    std::string getAllMonthlyTotals() const {
        std::map<std::string, double> totals;
        for (const auto& e : expenses) {
            totals[e.getMonth()] += e.getAmount();
        }
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        oss << "[";
        bool first = true;
        for (const auto& kv : totals) {
            if (!first) oss << ",";
            oss << "{\"month\":\"" << kv.first << "\",\"total\":" << kv.second;
            auto bit = monthlyBudgets.find(kv.first);
            if (bit != monthlyBudgets.end()) {
                oss << ",\"budget\":" << bit->second;
            } else {
                oss << ",\"budget\":0";
            }
            oss << "}";
            first = false;
        }
        oss << "]";
        return oss.str();
    }

    // ── Budget ────────────────────────────────────────────────────────────────
    std::string setBudget(const std::string& month, double budget) {
        if (budget < 0) return "{\"success\":false,\"error\":\"Budget must be non-negative\"}";
        monthlyBudgets[month] = budget;
        saveBudgets();
        return "{\"success\":true}";
    }

    std::string getBudget(const std::string& month) const {
        auto it = monthlyBudgets.find(month);
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        if (it != monthlyBudgets.end()) {
            oss << "{\"month\":\"" << month << "\",\"budget\":" << it->second << "}";
        } else {
            oss << "{\"month\":\"" << month << "\",\"budget\":0}";
        }
        return oss.str();
    }

    std::string getAllBudgets() const {
        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        oss << "[";
        bool first = true;
        for (const auto& kv : monthlyBudgets) {
            if (!first) oss << ",";
            oss << "{\"month\":\"" << kv.first << "\",\"budget\":" << kv.second << "}";
            first = false;
        }
        oss << "]";
        return oss.str();
    }

    std::string getCategories() const {
        std::string json = "[";
        for (size_t i = 0; i < Expense::VALID_CATEGORIES.size(); i++) {
            if (i > 0) json += ",";
            json += "\"" + Expense::VALID_CATEGORIES[i] + "\"";
        }
        return json + "]";
    }

    std::string getDashboardStats(const std::string& month) const {
        double monthTotal = 0.0;
        int monthCount = 0;
        double allTimeTotal = 0.0;
        std::map<std::string, double> catTotals;

        for (const auto& e : expenses) {
            allTimeTotal += e.getAmount();
            if (e.getMonth() == month) {
                monthTotal += e.getAmount();
                monthCount++;
                catTotals[e.getCategory()] += e.getAmount();
            }
        }

        std::string topCat = "";
        double topAmt = 0.0;
        for (const auto& kv : catTotals) {
            if (kv.second > topAmt) { topAmt = kv.second; topCat = kv.first; }
        }

        auto budgetIt = monthlyBudgets.find(month);
        double budget = (budgetIt != monthlyBudgets.end()) ? budgetIt->second : 0.0;

        std::ostringstream oss;
        oss << std::fixed << std::setprecision(2);
        oss << "{"
            << "\"monthTotal\":" << monthTotal
            << ",\"monthCount\":" << monthCount
            << ",\"allTimeTotal\":" << allTimeTotal
            << ",\"totalExpenses\":" << expenses.size()
            << ",\"budget\":" << budget
            << ",\"remaining\":" << (budget - monthTotal)
            << ",\"topCategory\":\"" << topCat << "\""
            << ",\"topCategoryAmount\":" << topAmt
            << "}";
        return oss.str();
    }
};

// ─── Global instance ──────────────────────────────────────────────────────────
static BudgetManager* g_manager = nullptr;

extern "C" {

EMSCRIPTEN_KEEPALIVE void init_manager() {
    if (!g_manager) g_manager = new BudgetManager();
}

EMSCRIPTEN_KEEPALIVE const char* add_expense(const char* date, const char* category,
                                              double amount, const char* note) {
    if (!g_manager) g_manager = new BudgetManager();
    static std::string result;
    result = g_manager->addExpense(date, category, amount, note);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* delete_expense(const char* id) {
    if (!g_manager) return "{\"success\":false}";
    static std::string result;
    result = g_manager->deleteExpense(id);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* edit_expense(const char* id, const char* date,
                                               const char* category, double amount,
                                               const char* note) {
    if (!g_manager) return "{\"success\":false}";
    static std::string result;
    result = g_manager->editExpense(id, date, category, amount, note);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_all_expenses() {
    if (!g_manager) g_manager = new BudgetManager();
    static std::string result;
    result = g_manager->getAllExpenses();
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_expenses_by_category(const char* category) {
    if (!g_manager) return "[]";
    static std::string result;
    result = g_manager->getExpensesByCategory(category);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_expenses_by_month(const char* month) {
    if (!g_manager) return "[]";
    static std::string result;
    result = g_manager->getExpensesByMonth(month);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_monthly_total(const char* month) {
    if (!g_manager) return "{}";
    static std::string result;
    result = g_manager->getMonthlyTotal(month);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_category_totals(const char* month) {
    if (!g_manager) return "{}";
    static std::string result;
    result = g_manager->getCategoryTotals(month);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_all_monthly_totals() {
    if (!g_manager) return "[]";
    static std::string result;
    result = g_manager->getAllMonthlyTotals();
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* set_budget(const char* month, double budget) {
    if (!g_manager) g_manager = new BudgetManager();
    static std::string result;
    result = g_manager->setBudget(month, budget);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_budget(const char* month) {
    if (!g_manager) return "{\"budget\":0}";
    static std::string result;
    result = g_manager->getBudget(month);
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_all_budgets() {
    if (!g_manager) return "[]";
    static std::string result;
    result = g_manager->getAllBudgets();
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_categories() {
    static std::string result;
    result = g_manager ? g_manager->getCategories()
           : "[\"Food\",\"Transport\",\"Shopping\",\"Entertainment\",\"Health\",\"Bills\",\"Education\",\"Travel\",\"Other\"]";
    return result.c_str();
}

EMSCRIPTEN_KEEPALIVE const char* get_dashboard_stats(const char* month) {
    if (!g_manager) g_manager = new BudgetManager();
    static std::string result;
    result = g_manager->getDashboardStats(month);
    return result.c_str();
}

} // extern "C"

// ─── Terminal mode (non-WASM) ─────────────────────────────────────────────────
#ifndef __EMSCRIPTEN__
int main() {
    BudgetManager manager;
    int choice;
    do {
        std::cout << "\n=== Monthly Money Coach ===\n"
                  << "1. Add Expense\n2. View All\n3. Search by Category\n"
                  << "4. Monthly Report\n5. Set Budget\n0. Exit\nChoice: ";
        std::cin >> choice;
        std::cin.ignore();

        if (choice == 1) {
            std::string date, cat, note;
            double amt;
            std::cout << "Date (DD-MM-YYYY): "; std::getline(std::cin, date);
            std::cout << "Category: "; std::getline(std::cin, cat);
            std::cout << "Amount: "; std::cin >> amt; std::cin.ignore();
            std::cout << "Note: "; std::getline(std::cin, note);
            std::cout << manager.addExpense(date, cat, amt, note) << "\n";
        } else if (choice == 2) {
            std::cout << manager.getAllExpenses() << "\n";
        } else if (choice == 3) {
            std::string cat;
            std::cout << "Category: "; std::getline(std::cin, cat);
            std::cout << manager.getExpensesByCategory(cat) << "\n";
        } else if (choice == 4) {
            std::string month;
            std::cout << "Month (MM-YYYY): "; std::getline(std::cin, month);
            std::cout << manager.getMonthlyTotal(month) << "\n";
            std::cout << manager.getCategoryTotals(month) << "\n";
        } else if (choice == 5) {
            std::string month; double budget;
            std::cout << "Month (MM-YYYY): "; std::getline(std::cin, month);
            std::cout << "Budget: "; std::cin >> budget;
            std::cout << manager.setBudget(month, budget) << "\n";
        }
    } while (choice != 0);
    return 0;
}
#endif
