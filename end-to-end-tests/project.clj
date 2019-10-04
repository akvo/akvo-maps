(defproject windshaft-test "0.1.0-SNAPSHOT"
  :description "FIXME: write description"
  :url "http://example.com/FIXME"
  :license {:name "Eclipse Public License"
            :url  "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.10.1"]
                 [clj-http "3.4.1"]
                 [cheshire "5.7.0"]
                 [org.postgresql/postgresql "42.2.8"]
                 [org.clojure/java.jdbc "0.5.8"]
                 [listora/again "0.1.0"]]
  :repl-options {:host    "0.0.0.0"
                 :port    47480})
